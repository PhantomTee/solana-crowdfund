import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, type Idl } from "@coral-xyz/anchor";
import { ChatAgent } from "@virtuals-protocol/game";
import { NETWORK_ENDPOINT } from "@/lib/constants";
import { agentStore } from "@/lib/agent-store";
import IDL_JSON from "@/lib/crowdfund-idl.json";

const VIRTUALS_KEY   = process.env.VIRTUALS_API_KEY ?? "";
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY ?? "";
const HEURIST_KEY    = process.env.HEURIST_API_KEY ?? "";
const COOLDOWN_MS    = 60_000;

// ── Read-only Anchor wallet shim (no signing needed) ──────────────────────────

const readOnlyWallet = {
  publicKey:           PublicKey.default,
  signTransaction:     async <T>(tx: T) => tx,
  signAllTransactions: async <T>(txs: T[]) => txs,
} as never;

// ── Virtuals Terminal API ─────────────────────────────────────────────────────

async function getTerminalToken(): Promise<string | null> {
  if (!VIRTUALS_KEY) return null;
  try {
    const res = await fetch("https://api.virtuals.io/api/accesses/tokens", {
      method: "POST",
      headers: { "X-API-KEY": VIRTUALS_KEY },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data?.accessToken ?? null;
  } catch {
    return null;
  }
}

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
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ data: { framework_name: "others", category_name: category, title, body } }),
      signal: AbortSignal.timeout(6_000),
    });
  } catch { /* non-critical */ }
}

// ── Virtuals ChatAgent reasoning ──────────────────────────────────────────────

async function callVirtuals(summaries: Omit<CampaignSummary, "score">[]): Promise<{ index: number; reasoning: string } | null> {
  if (!VIRTUALS_KEY) return null;
  try {
    const agent = new ChatAgent(
      VIRTUALS_KEY,
      `You are a Solana crowdfunding donation agent. You analyse active campaigns and
decide which single one most deserves a 1 USDC donation. You weigh three factors:
funding momentum (how close to goal), deadline urgency (days remaining), and
accountability (milestone count — more tranches means more transparent fund release).
Always respond with valid JSON only — no markdown, no explanation outside the JSON.`
    );

    const chat = await agent.createChat({ partnerId: "solfund-agent", partnerName: "SolFund" });

    const prompt = `Active campaigns on Solana Devnet:
${summaries.map((c, i) =>
  `${i + 1}. ${c.progressPct}% funded | ${c.daysLeft} days left | ${c.milestones} milestone tranches | goal: ${c.goalUsdc} USDC`
).join("\n")}

Pick the ONE campaign that most deserves the 1 USDC donation.
Respond with ONLY valid JSON:
{"campaignIndex": <0-based integer>, "reasoning": "<1-2 short sentences>"}`;

    const response = await chat.next(prompt);
    chat.end();

    const content = response?.message ?? "";
    const match   = content.match(/\{[\s\S]*?"campaignIndex"[\s\S]*?\}/);
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

// ── Heurist / OpenRouter fallback ─────────────────────────────────────────────

interface LLMConfig { baseUrl: string; apiKey: string; model: string; label: string; }

function getLLMConfig(): LLMConfig | null {
  if (OPENROUTER_KEY) return { baseUrl: "https://openrouter.ai/api/v1",         apiKey: OPENROUTER_KEY, model: "mistralai/mistral-7b-instruct:free",    label: "OpenRouter" };
  if (HEURIST_KEY)    return { baseUrl: "https://llm-gateway.heurist.xyz/v1",   apiKey: HEURIST_KEY,    model: "mistralai/mistral-7b-instruct-v0-2",   label: "Heurist"    };
  return null;
}

async function callLLMFallback(summaries: Omit<CampaignSummary, "score">[]): Promise<{ index: number; reasoning: string } | null> {
  const cfg = getLLMConfig();
  if (!cfg) return null;
  const prompt = `You are an AI agent choosing which Solana crowdfunding campaign to donate 1 USDC to.
Active campaigns:
${summaries.map((c, i) => `${i + 1}. ${c.progressPct}% funded, ${c.daysLeft} days left, ${c.milestones} milestones, goal ${c.goalUsdc} USDC`).join("\n")}
Pick the ONE campaign. Respond ONLY with valid JSON:
{"campaignIndex": <0-based number>, "reasoning": "<1-2 sentences>"}`;

  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: cfg.model, messages: [{ role: "user", content: prompt }], max_tokens: 400, temperature: 0.4 }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    const data    = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    const match   = content.match(/\{[\s\S]*?"campaignIndex"[\s\S]*?\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as { campaignIndex?: unknown; reasoning?: unknown };
    const idx    = Number(parsed.campaignIndex);
    if (!Number.isFinite(idx) || idx < 0 || idx >= summaries.length) return null;
    return { index: idx, reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning.trim() : "" };
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

function scoreCampaign(c: Omit<CampaignSummary, "score">): number {
  const progress      = c.progressPct / 100;
  const urgency       = Math.min(1, 1 / Math.max(c.daysLeft, 1)) * (30 / Math.max(c.daysLeft, 30));
  const accountability = Math.min(1, c.milestones / 10);
  return progress * 0.5 + urgency * 0.3 + accountability * 0.2;
}

function buildReasoning(chosen: CampaignSummary, all: CampaignSummary[]): string {
  const rank = [...all].sort((a, b) => b.score - a.score).findIndex((c) => c.pda === chosen.pda) + 1;
  const parts: string[] = [];
  if (chosen.progressPct >= 70) parts.push(`Campaign is ${chosen.progressPct}% funded and close to its goal.`);
  else if (chosen.progressPct >= 40) parts.push(`Campaign has raised ${chosen.progressPct}% and can reach its goal with more support.`);
  else parts.push(`Campaign is early-stage at ${chosen.progressPct}% and needs catalytic donations.`);
  if (chosen.daysLeft <= 3)      parts.push(`With only ${chosen.daysLeft} day${chosen.daysLeft === 1 ? "" : "s"} remaining, urgency is critical.`);
  else if (chosen.daysLeft <= 7) parts.push(`Only ${chosen.daysLeft} days left, making this time-sensitive.`);
  if (chosen.milestones > 1)     parts.push(`Its ${chosen.milestones}-milestone payout structure ensures funds are released responsibly.`);
  if (parts.length < 2)          parts.push(`Ranked #${rank} of ${all.length} active campaigns by composite score.`);
  return parts.join(" ");
}

// ── POST /api/agent/run ───────────────────────────────────────────────────────
//
// Returns a campaign decision only. The actual 1 USDC donation is submitted
// client-side by the connected user's wallet after they approve.

export async function POST() {
  const now     = Date.now();
  const elapsed = now - agentStore.getLastRunTime();

  if (elapsed < COOLDOWN_MS) {
    const remaining = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
    return Response.json({ error: `Cooldown active. Try again in ${remaining}s` }, { status: 429 });
  }

  const termToken = await getTerminalToken();
  await terminalLog(termToken, "general", "Agent Activated",
    "SolFund donation agent is analysing campaigns...\nNetwork: Solana Devnet"
  );

  // Build read-only provider for campaign fetching
  const connection = new Connection(NETWORK_ENDPOINT, "confirmed");
  const provider   = new AnchorProvider(connection, readOnlyWallet, { commitment: "confirmed" });
  const program    = new Program(IDL_JSON as Idl, provider);

  await terminalLog(termToken, "planner_module", "Fetching Campaigns",
    "Querying all on-chain CampaignState accounts from Solana Devnet..."
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let allCampaigns: any[];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    allCampaigns = await (program.account as any).campaignState.all();
  } catch (err) {
    await terminalLog(termToken, "general", "Error: Fetch Failed", `${err}`);
    return Response.json({ error: `Failed to fetch campaigns: ${err}` }, { status: 502 });
  }

  const nowSec = Math.floor(now / 1000);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeRaw = allCampaigns.filter(({ account }: any) =>
    account.deadline.toNumber() > nowSec && account.totalRaised.lt(account.goal)
  );

  if (activeRaw.length === 0) {
    await terminalLog(termToken, "general", "No Active Campaigns",
      "All campaigns are either fully funded or past their deadline."
    );
    return Response.json({ error: "No active campaigns found (all funded or expired)" }, { status: 404 });
  }

  // Score campaigns
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

  const reasoner = VIRTUALS_KEY ? "Virtuals GAME Agent" : getLLMConfig()?.label ?? "heuristic";
  await terminalLog(termToken, "planner_module", `Analysing ${summaries.length} Campaign${summaries.length === 1 ? "" : "s"}`,
    `Scoring: 50% momentum, 30% urgency, 20% accountability\n\n${analysisTable}\n\nReasoning engine: ${reasoner}`
  );

  // Reason: Virtuals → LLM fallback → heuristic
  const virtualsResult = await callVirtuals(summaries);
  const llmResult      = virtualsResult ?? await callLLMFallback(summaries);

  let chosen: CampaignSummary;
  let reasoning: string;

  if (virtualsResult) {
    chosen    = summaries[virtualsResult.index];
    reasoning = virtualsResult.reasoning || buildReasoning(chosen, summaries);
    await terminalLog(termToken, "planner_module", "Virtuals GAME Decision",
      `Selected Campaign ${chosen.index + 1}\n\n${reasoning}`
    );
  } else if (llmResult) {
    chosen    = summaries[llmResult.index];
    reasoning = llmResult.reasoning || buildReasoning(chosen, summaries);
    await terminalLog(termToken, "planner_module", `AI Decision (${getLLMConfig()?.label ?? "LLM"})`,
      `Selected Campaign ${chosen.index + 1}\n\n${reasoning}`
    );
  } else {
    chosen    = summaries.reduce((best, c) => c.score > best.score ? c : best, summaries[0]);
    reasoning = buildReasoning(chosen, summaries);
    await terminalLog(termToken, "planner_module", "Heuristic Decision",
      `No AI available. Selected Campaign ${chosen.index + 1} by weighted score.\n\n${reasoning}`
    );
  }

  await terminalLog(termToken, "reaction_module", "Decision Ready — Awaiting User Approval",
    `Campaign ${chosen.index + 1} selected. User must approve the 1 USDC donation from their wallet.\n\nPDA: \`${chosen.pda}\``
  );

  // Set cooldown so concurrent calls are rejected
  agentStore.setLastRunTime(now);

  return Response.json({
    campaignId:  chosen.pda,
    reasoning,
    goalUsdc:    chosen.goalUsdc,
    raisedUsdc:  chosen.raisedUsdc,
    progressPct: chosen.progressPct,
    daysLeft:    chosen.daysLeft,
    milestones:  chosen.milestones,
  });
}
