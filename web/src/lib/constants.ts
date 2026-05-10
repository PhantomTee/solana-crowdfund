import { PublicKey, clusterApiUrl } from "@solana/web3.js";

export const NETWORK_ENDPOINT = clusterApiUrl("devnet");
export const COMMITMENT = "confirmed" as const;

/** Circle USDC on Devnet — 6 decimals */
export const USDC_MINT = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
);
export const USDC_DECIMALS = 6;
export const LAMPORTS_PER_USDC = 1_000_000; // 10^6

/** Deployed program ID — updated after `anchor deploy` */
export const PROGRAM_ID = new PublicKey(
  "Eu8KcpvnwgpaDw6UsMgRCV29SYmEgESXoLxTEcAhK6Nm"
);

/** PDA seed strings — must match lib.rs constants */
export const CAMPAIGN_SEED = "campaign";
export const DONOR_SEED = "donor";
export const VAULT_SEED = "vault";

export const CIRCLE_FAUCET_URL = "https://faucet.circle.com/";
export const SOLANA_FAUCET_URL = "https://faucet.solana.com/";
