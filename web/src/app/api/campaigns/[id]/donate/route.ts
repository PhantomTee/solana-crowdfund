import { Connection, PublicKey } from "@solana/web3.js";
import { PROGRAM_ID, VAULT_SEED, USDC_MINT, NETWORK_ENDPOINT } from "@/lib/constants";
import { paymentStore } from "@/lib/payment-store";
import { NextRequest } from "next/server";

function deriveVault(campaignPDA: PublicKey): PublicKey {
  const [vaultPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from(VAULT_SEED), campaignPDA.toBuffer()],
    PROGRAM_ID
  );
  return vaultPDA;
}

// ── GET /api/campaigns/[id]/donate ──────────────────────────
// Returns 402 with x402 payment-required headers
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let vaultPDA: PublicKey;
  try {
    vaultPDA = deriveVault(new PublicKey(id));
  } catch {
    return Response.json({ error: "Invalid campaign address" }, { status: 400 });
  }

  const body = JSON.stringify({
    message:     "Payment required to donate to this campaign",
    protocol:    "x402",
    network:     "solana-devnet",
    recipient:   vaultPDA.toBase58(),
    mint:        USDC_MINT.toBase58(),
    amount:      "1000000",
    amountHuman: "1.00 USDC",
    instructions: [
      "1. Transfer ≥1 USDC (mint: " + USDC_MINT.toBase58() + ") to recipient address",
      "2. POST this endpoint with header  X-Payment: <tx_signature>",
    ],
  });

  return new Response(body, {
    status: 402,
    headers: {
      "Content-Type":          "application/json",
      "X-Payment-Required":    "true",
      "X-Payment-Amount":      "1000000",
      "X-Payment-Currency":    "USDC",
      "X-Payment-Decimals":    "6",
      "X-Payment-Mint":        USDC_MINT.toBase58(),
      "X-Payment-Network":     "solana-devnet",
      "X-Payment-Recipient":   vaultPDA.toBase58(),
      "X-Payment-Description": `Donate to SolFund campaign ${id.slice(0, 8)}…`,
    },
  });
}

// ── POST /api/campaigns/[id]/donate ─────────────────────────
// Accepts X-Payment: <tx_signature>, verifies on devnet, records
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const txSig = req.headers.get("X-Payment");

  if (!txSig) {
    return Response.json(
      { error: "X-Payment header is required (value: Solana tx signature)" },
      { status: 400 }
    );
  }

  let vaultPDA: PublicKey;
  try {
    vaultPDA = deriveVault(new PublicKey(id));
  } catch {
    return Response.json({ error: "Invalid campaign address" }, { status: 400 });
  }

  try {
    const connection = new Connection(NETWORK_ENDPOINT, "confirmed");

    // Poll up to ~12 s for confirmation
    let tx = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      tx = await connection.getTransaction(txSig, {
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      });
      if (tx) break;
      await new Promise((r) => setTimeout(r, 2000));
    }

    if (!tx) {
      return Response.json(
        { error: "Transaction not found on devnet. It may still be confirming, retry in a few seconds." },
        { status: 404 }
      );
    }

    if (tx.meta?.err) {
      return Response.json(
        { error: "Transaction failed on-chain", detail: tx.meta.err },
        { status: 400 }
      );
    }

    // Verify USDC transferred to the vault
    const postBalances = tx.meta?.postTokenBalances ?? [];
    const preBalances  = tx.meta?.preTokenBalances  ?? [];

    const vaultStr = vaultPDA.toBase58();
    const mintStr  = USDC_MINT.toBase58();

    const vaultPost = postBalances.find(
      (b) => b.mint === mintStr && b.owner === vaultStr
    );
    const vaultPre = preBalances.find(
      (b) => b.mint === mintStr && b.owner === vaultStr
    );

    const postAmt = Number(vaultPost?.uiTokenAmount?.amount ?? 0);
    const preAmt  = Number(vaultPre?.uiTokenAmount?.amount  ?? 0);
    const received = postAmt - preAmt;

    if (received < 1_000_000) {
      return Response.json(
        {
          error: "Insufficient USDC sent to campaign vault",
          expected: "≥ 1000000 micro-USDC (1 USDC)",
          received,
          vault: vaultStr,
        },
        { status: 400 }
      );
    }

    const isNew = paymentStore.record({
      campaignId:  id,
      txSig,
      amount:      received,
      amountUsdc:  received / 1_000_000,
      timestamp:   Date.now(),
    });

    return Response.json({
      success:    true,
      duplicate:  !isNew,
      txSig,
      amount:     received,
      amountUsdc: (received / 1_000_000).toFixed(6),
      vault:      vaultStr,
      message:    isNew ? "Donation recorded ✓" : "Already recorded (duplicate tx)",
      solscan:    `https://solscan.io/tx/${txSig}?cluster=devnet`,
    });

  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Verification failed" },
      { status: 500 }
    );
  }
}
