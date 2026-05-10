import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount,
  getAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { AnchorProvider, Program, type Idl, type Wallet } from "@coral-xyz/anchor";
import BN from "bn.js";
import {
  NETWORK_ENDPOINT,
  USDC_MINT,
  PROGRAM_ID,
  VAULT_SEED,
  DONOR_SEED,
} from "@/lib/constants";
import { agentStore } from "@/lib/agent-store";
import { paymentStore } from "@/lib/payment-store";
import IDL_JSON from "@/lib/crowdfund-idl.json";

const AGENT_SECRET      = process.env.AGENT_SOLANA_SECRET_KEY ?? "";
const TERMINAL_KEY      = process.env.VIRTUALS_API_KEY ?? "";
const OPENROUTER_KEY    = process.env.OPENROUTER_API_KEY ?? "";
const HEURIST_KEY       = process.env.HEURIST_API_KEY ?? "";
const DONATION_USDC     = 1_000_000; // 1 USDC in micro-USDC
const COOLDOWN_MS       = 60_000;    // 60 s

// ── Virtuals Terminal API ─────────────────────────────────────────────────────

/** Exchange the Terminal API key for a short-lived access token */
async function getTerminalToken(): Promise<string | null> {
  if (!TERMINAL_KEY) return null;
  try {
    const res = await fetch("https://api.virtuals.io/api/accesses/tokens", {
      method: "POST",
      headers: { "X-API-KEY": TERMINAL_KEY },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data?.accessToken ?? null;
  } catch {
    return null;
  }
}

/** Stream a log entry to the Virtuals Terminal — fire-and-forget, never throws */
async function terminalLog(
  token: string | null,
  category: "general" | "planner_module" | "reaction_module",
  title: string,
  body: string
): Promise<void> {
  if (!token) return;
  try {
    await fetch("https://api-terminal.virtuals.io/logs", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          framework_name: "others",
          category_name:  category,
          title,
          body,
        },
      }),
      signal: AbortSignal.timeout(6_000),
    });
  } catch {
    // Terminal logging is non-critical — never block the main flow
  }
}

// ── LLM reasoning (OpenRouter or Heurist) ────────────────────────────────────

interface LLMConfig {
  baseUrl: string;
  apiKey:  string;
  model:   string;
  label:   string;
}

function getLLMConfig(): LLMConfig | null {
  if (OPENROUTER_KEY) return {
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey:  OPENROUTER_KEY,
    model:   "mistralai/mistral-7b-instruct:free",
    label:   "OpenRouter (Mistral 7B)",
  };
  if (HEURIST_KEY) return {
    baseUrl: "https://llm-gateway.heurist.xyz/v1",
    apiKey:  HEURIST_KEY,
    model:   "mistralai/mistral-7b-instruct-v0-2",
    label:   "Heurist (Mistral 7B)",
  };
  return null;
}

async function callLLM(summaries: Omit<CampaignSummary, "score">[]): Promise<{ index: number; reasoning: string } | null> {
  const cfg = getLLMConfig();
  if (!cfg) return null;

  const prompt = `You are an AI agent choosing which Solana crowdfunding campaign to donate 1 USDC to.

Active campaigns:
${summaries.map((c, i) => `${i + 1}. ${c.progressPct}% funded, ${c.daysLeft} days left, ${c.milestones} milestone tranches, goal ${c.goalUsdc} USDC`).join("\n")}

Pick the ONE campaign that most deserves the donation. Consider: funding momentum (closer to goal), urgency (days left), and accountability (more milestones = more transparent spending).

Respond with ONLY valid JSON, no markdown, no trailing text:
{"campaignIndex": <0-based number>, "reasoning": "<1-2 short sentences max>"}`;

  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${cfg.apiKey}`,
        "Content-Type":  "application/json",
        ...(OPENROUTER_KEY ? { "HTTP-Referer": "https://solfund.app", "X-Title": "SolFund Agent" } : {}),
      },
      body: JSON.stringify({
        model:      cfg.model,
        messages:   [{ role: "user", content: prompt }],
        max_tokens: 400,
        temperature: 0.4,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) return null;

    const data   = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    const match  = content.match(/\{[\s\S]*?"campaignIndex"[\s\S]*?\}/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]) as { campaignIndex?: unknown; reasoning?: unknown };
    const idx    = Number(parsed.campaignIndex);
    if (!Number.isFinite(idx) || idx < 0 || idx >= summaries.length) return null;

    return {
      index:     idx,
      reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning.trim() : "",
    };
  } catch {
    return null;
  }
}

// ── Campaign scoring ──────────────────────────────────────────────────────────

interface CampaignSummary {
  index:       number;
  pda:         string;
  goalUsdc:    number;
  raisedUsdc:  number;
  progressPct: number;
  daysLeft:    number;
  milestones:  number;
  score:       number;
}

/**
 * Weighted score:
 *  50% progress momentum (closer to goal = higher score)
 *  30% urgency (fewer days left = higher score, capped at 30 days)
 *  20% accountability (more milestone tranches = more transparent)
 */
function scoreCampaign(c: Omit<CampaignSummary, "score">): number {
  const progress     = c.progressPct / 100;
  const urgency      = Math.min(1, 1 / Math.max(c.daysLeft, 1)) * (30 / Math.max(c.daysLeft, 30));
  const accountability = Math.min(1, c.milestones / 10);
  return progress * 0.5 + urgency * 0.3 + accountability * 0.2;
}

function buildReasoning(chosen: CampaignSummary, all: CampaignSummary[]): string {
  const rank = [...all].sort((a, b) => b.score - a.score).findIndex((c) => c.pda === chosen.pda) + 1;
  const parts: string[] = [];

  if (chosen.progressPct >= 70)
    parts.push(`Campaign is ${chosen.progressPct}% funded and has strong momentum toward its goal.`);
  else if (chosen.progressPct >= 40)
    parts.push(`Campaign has raised ${chosen.progressPct}% of its goal and can reach it with more support.`);
  else
    parts.push(`Campaign is early-stage at ${chosen.progressPct}% and needs catalytic donations to build momentum.`);

  if (chosen.daysLeft <= 3)
    parts.push(`With only ${chosen.daysLeft} day${chosen.daysLeft === 1 ? "" : "s"} remaining, urgency is critical.`);
  else if (chosen.daysLeft <= 7)
    parts.push(`Only ${chosen.daysLeft} days left, making this donation time-sensitive.`);

  if (chosen.milestones > 1)
    parts.push(`Its ${chosen.milestones}-milestone payout structure ensures funds are released responsibly.`);

  if (parts.length < 2)
    parts.push(`Ranked #${rank} of ${all.length} active campaigns by composite score.`);

  return parts.join(" ");
}

// ── Wallet helper ─────────────────────────────────────────────────────────────

function makeWallet(kp: Keypair): Wallet {
  return {
    publicKey: kp.publicKey,
    signTransaction: async <T extends Transaction | VersionedTransaction>(tx: T) => {
      if (tx instanceof Transaction) tx.partialSign(kp);
      else tx.sign([kp]);
      return tx;
    },
    signAllTransactions: async <T extends Transaction | VersionedTransaction>(txs: T[]) =>
      txs.map((tx) => {
        if (tx instanceof Transaction) tx.partialSign(kp);
        else tx.sign([kp]);
        return tx;
      }),
    payer: kp,
  } as unknown as Wallet;
}

// ── POST /api/agent/run ───────────────────────────────────────────────────────

export async function POST() {
  // 1. Cooldown check
  const now = Date.now();
  const elapsed = now - agentStore.getLastRunTime();
  if (elapsed < COOLDOWN_MS) {
    const remaining = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
    return Response.json(
      { error: `Cooldown active. Try again in ${remaining}s` },
      { status: 429 }
    );
  }

  if (!AGENT_SECRET) {
    return Response.json({ error: "AGENT_SOLANA_SECRET_KEY not set" }, { status: 500 });
  }

  // 2. Load agent keypair + get Terminal token (parallel)
  let agentKp: Keypair;
  try {
    agentKp = Keypair.fromSecretKey(Buffer.from(AGENT_SECRET, "base64"));
  } catch {
    return Response.json({ error: "Invalid agent secret key" }, { status: 500 });
  }

  const [termToken] = await Promise.all([getTerminalToken()]);

  await terminalLog(termToken, "general", "Agent Activated",
    `SolFund donation agent woke up.\nWallet: \`${agentKp.publicKey.toBase58()}\`\nNetwork: Solana Devnet`
  );

  const connection = new Connection(NETWORK_ENDPOINT, "confirmed");
  const wallet     = makeWallet(agentKp);
  const provider   = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  const program    = new Program(IDL_JSON as Idl, provider);

  // 3. Fetch active campaigns
  await terminalLog(termToken, "planner_module", "Fetching Campaigns",
    "Querying all on-chain crowdfunding campaigns from Solana Devnet..."
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let allCampaigns: any[];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    allCampaigns = await (program.account as any).campaignState.all();
  } catch (err) {
    await terminalLog(termToken, "general", "Error: Chain Fetch Failed", `${err}`);
    return Response.json({ error: `Failed to fetch campaigns: ${err}` }, { status: 502 });
  }

  const nowSec = Math.floor(now / 1000);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeRaw = allCampaigns.filter(({ account }: any) =>
    account.deadline.toNumber() > nowSec && account.totalRaised.lt(account.goal)
  );

  if (activeRaw.length === 0) {
    await terminalLog(termToken, "general", "No Campaigns Found",
      "All campaigns are either fully funded or past their deadline. Nothing to donate to."
    );
    return Response.json(
      { error: "No active campaigns found (all funded or expired)" },
      { status: 404 }
    );
  }

  // 4. Check agent USDC balance
  let agentMicro = 0;
  try {
    const ata  = getAssociatedTokenAddressSync(USDC_MINT, agentKp.publicKey);
    const acct = await getAccount(connection, ata);
    agentMicro = Number(acct.amount);
  } catch { /* ATA not initialised yet */ }

  if (agentMicro < DONATION_USDC) {
    const msg = `Insufficient USDC: agent has ${(agentMicro / 1e6).toFixed(2)} USDC, needs 1.00 USDC`;
    await terminalLog(termToken, "general", "Insufficient Funds", msg);
    return Response.json(
      { error: msg, fundingAddress: agentKp.publicKey.toBase58(), faucetUrl: "https://faucet.circle.com/" },
      { status: 400 }
    );
  }

  // 5. Score campaigns and pick the best one
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const summaries: CampaignSummary[] = activeRaw.map(({ publicKey, account }: any, i: number) => {
    const base = {
      index:       i,
      pda:         (publicKey as PublicKey).toBase58(),
      goalUsdc:    account.goal.toNumber() / 1e6,
      raisedUsdc:  account.totalRaised.toNumber() / 1e6,
      progressPct: Math.round((account.totalRaised.toNumber() / account.goal.toNumber()) * 100),
      daysLeft:    Math.max(0, Math.ceil((account.deadline.toNumber() - nowSec) / 86400)),
      milestones:  account.milestoneCount,
    };
    return { ...base, score: scoreCampaign(base) };
  });

  const analysisTable = summaries
    .map((c) => `- Campaign ${c.index + 1}: ${c.progressPct}% funded, ${c.daysLeft}d left, ${c.milestones} milestones, score ${c.score.toFixed(3)}`)
    .join("\n");

  const llmCfg = getLLMConfig();
  await terminalLog(termToken, "planner_module", `Analysing ${summaries.length} Active Campaign${summaries.length === 1 ? "" : "s"}`,
    `Scoring by: 50% funding momentum, 30% deadline urgency, 20% milestone accountability\n\n${analysisTable}\n\n${llmCfg ? `LLM: ${llmCfg.label}` : "LLM: not configured (heuristic mode)"}`
  );

  // Try LLM reasoning first; fall back to heuristic score if unavailable
  const llmResult = await callLLM(summaries);

  let chosen: CampaignSummary;
  let reasoning: string;

  if (llmResult) {
    chosen    = summaries[llmResult.index];
    reasoning = llmResult.reasoning || buildReasoning(chosen, summaries);
    await terminalLog(termToken, "planner_module", `AI Decision (${llmCfg?.label ?? "LLM"})`,
      `Selected Campaign ${chosen.index + 1}\n\n${reasoning}`
    );
  } else {
    chosen    = summaries.reduce((best, c) => c.score > best.score ? c : best, summaries[0]);
    reasoning = buildReasoning(chosen, summaries);
    await terminalLog(termToken, "planner_module", "Heuristic Decision",
      `LLM unavailable. Selected Campaign ${chosen.index + 1} by weighted score.\n\n${reasoning}`
    );
  }

  await terminalLog(termToken, "planner_module", "Campaign Selected",
    `**Campaign ${chosen.index + 1}** chosen (score: ${chosen.score.toFixed(3)})\n\n${reasoning}\n\nPDA: \`${chosen.pda}\``
  );

  // 6. Set cooldown immediately so concurrent calls are rejected
  agentStore.setLastRunTime(now);

  const campaignPDA: PublicKey = activeRaw[chosen.index].publicKey;

  // 7. Ensure agent ATA exists
  let agentAta: PublicKey;
  try {
    const ataAcct = await getOrCreateAssociatedTokenAccount(
      connection, agentKp, USDC_MINT, agentKp.publicKey
    );
    agentAta = ataAcct.address;
  } catch (err) {
    const msg = `ATA init failed: ${err}`;
    await terminalLog(termToken, "general", "Error: ATA Init Failed", msg);
    const run = { id: `run-${now}`, timestamp: now, campaignId: campaignPDA.toBase58(), amountUsdc: 1, txSig: "", reasoning, status: "error" as const, error: msg };
    agentStore.record(run);
    return Response.json({ error: msg, reasoning }, { status: 500 });
  }

  // 8. Derive PDAs
  const [vaultPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from(VAULT_SEED), campaignPDA.toBuffer()], PROGRAM_ID
  );
  const [donorStatePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from(DONOR_SEED), campaignPDA.toBuffer(), agentKp.publicKey.toBuffer()], PROGRAM_ID
  );

  await terminalLog(termToken, "reaction_module", "Executing Donation",
    `Submitting **1 USDC** to campaign vault via Anchor \`contribute\` instruction.\nVault: \`${vaultPDA.toBase58()}\``
  );

  // 9. Call contribute instruction
  let txSig: string;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    txSig = await (program.methods as any)
      .contribute(new BN(DONATION_USDC))
      .accounts({
        donor:                  agentKp.publicKey,
        campaign:               campaignPDA,
        donorUsdcAta:           agentAta,
        vault:                  vaultPDA,
        donorState:             donorStatePDA,
        tokenProgram:           TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram:          SystemProgram.programId,
      })
      .rpc();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await terminalLog(termToken, "general", "Error: Transaction Failed", `\`\`\`\n${msg}\n\`\`\``);
    const run = { id: `run-${now}`, timestamp: now, campaignId: campaignPDA.toBase58(), amountUsdc: 1, txSig: "", reasoning, status: "error" as const, error: msg };
    agentStore.record(run);
    return Response.json({ error: `Transaction failed: ${msg}`, reasoning }, { status: 500 });
  }

  // 10. Record results
  paymentStore.record({
    campaignId: campaignPDA.toBase58(),
    txSig,
    amount:     DONATION_USDC,
    amountUsdc: 1,
    timestamp:  now,
    source:     "agent",
  });

  agentStore.record({
    id:         `run-${now}`,
    timestamp:  now,
    campaignId: campaignPDA.toBase58(),
    amountUsdc: 1,
    txSig,
    reasoning,
    status:     "success",
  });

  await terminalLog(termToken, "general", "Donation Complete",
    `**1 USDC donated successfully.**\n\nCampaign: \`${campaignPDA.toBase58().slice(0, 16)}...\`\nTx: \`${txSig}\`\n[View on Solscan](https://solscan.io/tx/${txSig}?cluster=devnet)`
  );

  return Response.json({
    success:    true,
    campaignId: campaignPDA.toBase58(),
    amountUsdc: 1,
    txSig,
    reasoning,
    solscan:    `https://solscan.io/tx/${txSig}?cluster=devnet`,
  });
}
