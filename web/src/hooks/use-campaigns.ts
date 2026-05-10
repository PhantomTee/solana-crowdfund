"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from "@solana/spl-token";
import BN from "bn.js";
import { useCrowdfundProgram } from "./use-crowdfund-program";
import { USDC_MINT } from "@/lib/constants";

// ─── Fetching hooks ───────────────────────────────────────────────────────────

/** Fetch all campaigns on-chain */
export function useCampaigns() {
  const { program } = useCrowdfundProgram();

  return useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      if (!program) return [];
      // @ts-expect-error – dynamic IDL typing
      return program.account.campaignState.all();
    },
    enabled: !!program,
    refetchInterval: 30_000,
  });
}

/** Fetch a single campaign by its PDA address string */
export function useCampaign(campaignPDAStr: string | undefined) {
  const { program } = useCrowdfundProgram();

  return useQuery({
    queryKey: ["campaign", campaignPDAStr],
    queryFn: async () => {
      if (!program || !campaignPDAStr) return null;
      const pda = new PublicKey(campaignPDAStr);
      // @ts-expect-error – dynamic IDL typing
      return program.account.campaignState.fetch(pda);
    },
    enabled: !!program && !!campaignPDAStr,
    refetchInterval: 15_000,
  });
}

/** Fetch a donor's DonorState PDA (null = no contribution yet) */
export function useDonorState(
  campaignPDA: PublicKey | undefined,
  donor: PublicKey | undefined
) {
  const { program, deriveDonorStatePDA } = useCrowdfundProgram();

  return useQuery({
    queryKey: ["donor-state", campaignPDA?.toBase58(), donor?.toBase58()],
    queryFn: async () => {
      if (!program || !campaignPDA || !donor) return null;
      const [donorStatePDA] = deriveDonorStatePDA(campaignPDA, donor);
      try {
        // @ts-expect-error – dynamic IDL typing
        return await program.account.donorState.fetch(donorStatePDA);
      } catch {
        return null; // Account does not exist yet
      }
    },
    enabled: !!program && !!campaignPDA && !!donor,
  });
}

// ─── Mutation hooks ───────────────────────────────────────────────────────────

export interface CreateCampaignArgs {
  goalUsdc: number;       // human USDC amount
  deadlineTs: number;     // unix timestamp
  milestones: number[];   // array of percentages summing to 100
  beneficiary: PublicKey;
}

/** Create a new campaign */
export function useCreateCampaign() {
  const { program, deriveCampaignPDA, deriveVaultPDA } = useCrowdfundProgram();
  const { publicKey } = useWallet();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (args: CreateCampaignArgs) => {
      if (!program || !publicKey) throw new Error("Wallet not connected");

      const campaignId = new BN(Date.now());
      const goal = new BN(args.goalUsdc * 1_000_000);
      const deadline = new BN(args.deadlineTs);

      const [campaignPDA] = deriveCampaignPDA(publicKey, campaignId);
      const [vaultPDA] = deriveVaultPDA(campaignPDA);

      const tx = await program.methods
        .initializeCampaign(
          goal,
          deadline,
          Buffer.from(args.milestones),   // Vec<u8> requires Buffer, not number[]
          args.beneficiary,
          campaignId
        )
        .accounts({
          creator: publicKey,
          usdcMint: USDC_MINT,
          campaign: campaignPDA,
          vault: vaultPDA,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        } as never)
        .rpc();

      return { tx, campaignPDA: campaignPDA.toBase58() };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["campaigns"] }),
  });
}

/** Contribute USDC to a campaign */
export function useContribute(campaignPDA: PublicKey) {
  const { program, deriveVaultPDA, deriveDonorStatePDA } = useCrowdfundProgram();
  const { publicKey } = useWallet();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (amountUsdc: number) => {
      if (!program || !publicKey) throw new Error("Wallet not connected");

      const amount = new BN(amountUsdc * 1_000_000);
      const [vaultPDA] = deriveVaultPDA(campaignPDA);
      const [donorStatePDA] = deriveDonorStatePDA(campaignPDA, publicKey);
      const donorUsdcAta = getAssociatedTokenAddressSync(USDC_MINT, publicKey);

      return program.methods
        .contribute(amount)
        .accounts({
          donor: publicKey,
          campaign: campaignPDA,
          donorUsdcAta,
          vault: vaultPDA,
          donorState: donorStatePDA,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as never)
        .rpc();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign", campaignPDA.toBase58()] });
      qc.invalidateQueries({ queryKey: ["donor-state", campaignPDA.toBase58()] });
    },
  });
}

/** Release the next milestone (creator/beneficiary only) */
export function useReleaseMilestone(campaignPDA: PublicKey, beneficiary: PublicKey) {
  const { program, deriveVaultPDA } = useCrowdfundProgram();
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!program || !publicKey) throw new Error("Wallet not connected");

      const [vaultPDA] = deriveVaultPDA(campaignPDA);
      const beneficiaryUsdcAta = getAssociatedTokenAddressSync(USDC_MINT, beneficiary);

      // If the beneficiary has never received USDC their ATA won't exist yet.
      // Prepend a create-ATA instruction so the milestone release never fails.
      const preInstructions = [];
      try {
        await getAccount(connection, beneficiaryUsdcAta);
      } catch {
        preInstructions.push(
          createAssociatedTokenAccountInstruction(
            publicKey,          // payer
            beneficiaryUsdcAta,
            beneficiary,
            USDC_MINT
          )
        );
      }

      return program.methods
        .releaseMilestone()
        .accounts({
          caller: publicKey,
          campaign: campaignPDA,
          vault: vaultPDA,
          beneficiaryUsdcAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        } as never)
        .preInstructions(preInstructions)
        .rpc();
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["campaign", campaignPDA.toBase58()] }),
  });
}

/** Claim refund for a failed campaign */
export function useClaimRefund(campaignPDA: PublicKey) {
  const { program, deriveVaultPDA, deriveDonorStatePDA } = useCrowdfundProgram();
  const { publicKey } = useWallet();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!program || !publicKey) throw new Error("Wallet not connected");

      const [vaultPDA] = deriveVaultPDA(campaignPDA);
      const [donorStatePDA] = deriveDonorStatePDA(campaignPDA, publicKey);
      const donorUsdcAta = getAssociatedTokenAddressSync(USDC_MINT, publicKey);

      return program.methods
        .claimRefund()
        .accounts({
          donor: publicKey,
          campaign: campaignPDA,
          vault: vaultPDA,
          donorUsdcAta,
          donorState: donorStatePDA,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        } as never)
        .rpc();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign", campaignPDA.toBase58()] });
      qc.invalidateQueries({
        queryKey: ["donor-state", campaignPDA.toBase58(), publicKey?.toBase58()],
      });
    },
  });
}
