import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, getAccount } from "@solana/spl-token";
import { NETWORK_ENDPOINT, USDC_MINT } from "@/lib/constants";

const AGENT_PUBLIC_KEY = process.env.AGENT_SOLANA_PUBLIC_KEY ?? "";

export async function GET() {
  if (!AGENT_PUBLIC_KEY) {
    return Response.json({ error: "Agent wallet not configured" }, { status: 500 });
  }

  let pubkey: PublicKey;
  try {
    pubkey = new PublicKey(AGENT_PUBLIC_KEY);
  } catch {
    return Response.json({ error: "Invalid agent public key" }, { status: 500 });
  }

  const connection = new Connection(NETWORK_ENDPOINT, "confirmed");

  const [solLamports, usdcBalance] = await Promise.all([
    connection.getBalance(pubkey).catch(() => 0),
    (async () => {
      try {
        const ata = getAssociatedTokenAddressSync(USDC_MINT, pubkey);
        const account = await getAccount(connection, ata);
        return Number(account.amount) / 1_000_000;
      } catch {
        return 0; // ATA doesn't exist yet
      }
    })(),
  ]);

  return Response.json({
    publicKey:   AGENT_PUBLIC_KEY,
    solBalance:  solLamports / LAMPORTS_PER_SOL,
    usdcBalance,
    faucetUrl:   "https://faucet.circle.com/",
    solFaucetUrl: "https://faucet.solana.com/",
  });
}
