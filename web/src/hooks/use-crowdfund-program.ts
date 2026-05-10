"use client";

import { useMemo } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { AnchorProvider, Program, type Idl } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import {
  PROGRAM_ID,
  CAMPAIGN_SEED,
  DONOR_SEED,
  VAULT_SEED,
} from "@/lib/constants";

// IDL copied from anchor/target/idl/crowdfund.json after `anchor build`.
import IDL_JSON from "@/lib/crowdfund-idl.json";
const IDL = IDL_JSON as Idl;

export function useCrowdfundProgram() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const provider = useMemo(() => {
    if (!wallet.publicKey || !wallet.signTransaction) return null;
    return new AnchorProvider(
      connection,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      wallet as any,
      { commitment: "confirmed" }
    );
  }, [connection, wallet]);

  const program = useMemo(() => {
    if (!provider) return null;
    return new Program(IDL, provider);
  }, [provider]);

  // ── PDA derivation helpers ──────────────────────────────────────────────

  function deriveCampaignPDA(
    creator: PublicKey,
    campaignId: BN
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from(CAMPAIGN_SEED),
        creator.toBuffer(),
        campaignId.toArrayLike(Buffer, "le", 8),
      ],
      PROGRAM_ID
    );
  }

  function deriveVaultPDA(campaignPDA: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(VAULT_SEED), campaignPDA.toBuffer()],
      PROGRAM_ID
    );
  }

  function deriveDonorStatePDA(
    campaignPDA: PublicKey,
    donor: PublicKey
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from(DONOR_SEED), campaignPDA.toBuffer(), donor.toBuffer()],
      PROGRAM_ID
    );
  }

  return {
    program,
    provider,
    deriveCampaignPDA,
    deriveVaultPDA,
    deriveDonorStatePDA,
  };
}
