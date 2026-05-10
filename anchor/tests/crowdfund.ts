/**
 * crowdfund.ts — Integration tests for the Crowdfund Anchor program
 *
 * Run with:  anchor test --skip-local-validator  (against devnet)
 *            anchor test                          (against local validator)
 *
 * Pre-requisites for devnet:
 *   - Funded wallet at ~/.config/solana/id.json
 *   - Donor account must hold Devnet USDC (https://faucet.circle.com/)
 *   - Set ANCHOR_PROVIDER_URL=https://api.devnet.solana.com
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  createMint,
  getAccount,
} from "@solana/spl-token";
import { Crowdfund } from "../target/types/crowdfund";
import assert from "assert";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Circle's USDC on Devnet (6 decimals). Change to local mock when testing locally. */
const USDC_DEVNET_MINT = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
);
const ONE_USDC = new BN(1_000_000); // 1 USDC in base units

// ─── PDA helpers ─────────────────────────────────────────────────────────────

function deriveCampaignPDA(
  programId: PublicKey,
  creator: PublicKey,
  campaignId: BN
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("campaign"),
      creator.toBuffer(),
      campaignId.toArrayLike(Buffer, "le", 8),
    ],
    programId
  );
}

function deriveVaultPDA(
  programId: PublicKey,
  campaignPDA: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), campaignPDA.toBuffer()],
    programId
  );
}

function deriveDonorStatePDA(
  programId: PublicKey,
  campaignPDA: PublicKey,
  donor: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("donor"), campaignPDA.toBuffer(), donor.toBuffer()],
    programId
  );
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe("crowdfund", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Crowdfund as Program<Crowdfund>;
  const connection = provider.connection;

  // Keypairs
  const creator = (provider.wallet as anchor.Wallet).payer;
  const donor = Keypair.generate();
  const beneficiary = Keypair.generate();

  // We use a locally-created mock USDC mint for reproducible tests.
  // On a live devnet run, swap mockUsdcMint for USDC_DEVNET_MINT.
  let mockUsdcMint: PublicKey;
  let mintAuthority: Keypair;

  let campaignPDA: PublicKey;
  let vaultPDA: PublicKey;
  let donorStatePDA: PublicKey;
  let donorUsdcAta: PublicKey;
  let beneficiaryUsdcAta: PublicKey;

  const campaignId = new BN(Date.now());

  // ── Setup ──────────────────────────────────────────────────────────────────
  before(async () => {
    // Fund the donor with SOL for fees.
    const sig = await connection.requestAirdrop(donor.publicKey, 2_000_000_000);
    await connection.confirmTransaction(sig, "confirmed");

    // Create a local mock USDC mint for deterministic testing.
    mintAuthority = Keypair.generate();
    const mintAuthSig = await connection.requestAirdrop(
      mintAuthority.publicKey,
      2_000_000_000
    );
    await connection.confirmTransaction(mintAuthSig, "confirmed");

    mockUsdcMint = await createMint(
      connection,
      creator,
      mintAuthority.publicKey,
      null,
      6 // 6 decimals — same as real USDC
    );

    // Derive PDAs.
    [campaignPDA] = deriveCampaignPDA(program.programId, creator.publicKey, campaignId);
    [vaultPDA] = deriveVaultPDA(program.programId, campaignPDA);
    [donorStatePDA] = deriveDonorStatePDA(program.programId, campaignPDA, donor.publicKey);

    // Create associated token accounts.
    const donorAta = await getOrCreateAssociatedTokenAccount(
      connection,
      creator,
      mockUsdcMint,
      donor.publicKey
    );
    donorUsdcAta = donorAta.address;

    const beneficiaryAta = await getOrCreateAssociatedTokenAccount(
      connection,
      creator,
      mockUsdcMint,
      beneficiary.publicKey
    );
    beneficiaryUsdcAta = beneficiaryAta.address;

    // Mint 500 USDC to donor.
    await mintTo(
      connection,
      creator,
      mockUsdcMint,
      donorUsdcAta,
      mintAuthority,
      500 * 1_000_000
    );

    // Mint some USDC to beneficiary ATA so it's pre-created.
    await mintTo(
      connection,
      creator,
      mockUsdcMint,
      beneficiaryUsdcAta,
      mintAuthority,
      0
    );

    console.log(`\nProgram ID:    ${program.programId.toBase58()}`);
    console.log(`Campaign PDA:  ${campaignPDA.toBase58()}`);
    console.log(`Vault PDA:     ${vaultPDA.toBase58()}`);
    console.log(`Mock USDC:     ${mockUsdcMint.toBase58()}`);
  });

  // ── Test 1: initialize_campaign ────────────────────────────────────────────
  it("initialises a campaign with 3 milestones [50, 30, 20]", async () => {
    const goal = ONE_USDC.muln(100); // 100 USDC
    const deadline = new BN(Math.floor(Date.now() / 1000) + 86_400 * 30); // 30 days
    const milestones = [50, 30, 20];

    const tx = await program.methods
      .initializeCampaign(goal, deadline, milestones, beneficiary.publicKey, campaignId)
      .accounts({
        creator: creator.publicKey,
        usdcMint: mockUsdcMint,
        campaign: campaignPDA,
        vault: vaultPDA,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([creator])
      .rpc();
    console.log("  initialize_campaign tx:", tx);

    const campaign = await program.account.campaignState.fetch(campaignPDA);
    assert.ok(campaign.goal.eq(goal), "goal mismatch");
    assert.strictEqual(campaign.milestoneCount, 3);
    assert.strictEqual(campaign.milestonesReleased, 0);
    assert.ok(campaign.totalRaised.isZero(), "totalRaised should be 0");
    assert.deepStrictEqual(
      Array.from(campaign.milestonePercentages.slice(0, 3)),
      [50, 30, 20]
    );
    assert.strictEqual(
      campaign.beneficiary.toBase58(),
      beneficiary.publicKey.toBase58()
    );
  });

  // ── Test 2: contribute ─────────────────────────────────────────────────────
  it("accepts a contribution of 10 USDC from a donor", async () => {
    const amount = ONE_USDC.muln(10); // 10 USDC

    const tx = await program.methods
      .contribute(amount)
      .accounts({
        donor: donor.publicKey,
        campaign: campaignPDA,
        donorUsdcAta: donorUsdcAta,
        vault: vaultPDA,
        donorState: donorStatePDA,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([donor])
      .rpc();
    console.log("  contribute tx:", tx);

    const donorState = await program.account.donorState.fetch(donorStatePDA);
    assert.ok(donorState.amount.eq(amount), "donor_state.amount mismatch");
    assert.strictEqual(
      donorState.donor.toBase58(),
      donor.publicKey.toBase58()
    );

    const campaign = await program.account.campaignState.fetch(campaignPDA);
    assert.ok(campaign.totalRaised.eq(amount), "campaign.totalRaised mismatch");

    const vaultBalance = (await getAccount(connection, vaultPDA)).amount;
    assert.strictEqual(vaultBalance, BigInt(amount.toString()));
  });

  // ── Test 3: second contribute accumulates ──────────────────────────────────
  it("accumulates a second contribution in the same DonorState", async () => {
    const amount2 = ONE_USDC.muln(5); // 5 USDC

    await program.methods
      .contribute(amount2)
      .accounts({
        donor: donor.publicKey,
        campaign: campaignPDA,
        donorUsdcAta: donorUsdcAta,
        vault: vaultPDA,
        donorState: donorStatePDA,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([donor])
      .rpc();

    const donorState = await program.account.donorState.fetch(donorStatePDA);
    assert.ok(
      donorState.amount.eq(ONE_USDC.muln(15)),
      "expected 15 USDC total donation"
    );
  });

  // ── Test 4: reject zero contribution ──────────────────────────────────────
  it("rejects a contribution of zero USDC", async () => {
    try {
      await program.methods
        .contribute(new BN(0))
        .accounts({
          donor: donor.publicKey,
          campaign: campaignPDA,
          donorUsdcAta: donorUsdcAta,
          vault: vaultPDA,
          donorState: donorStatePDA,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([donor])
        .rpc();
      assert.fail("Expected ZeroContribution error");
    } catch (err: any) {
      assert.ok(
        err.message.includes("ZeroContribution") ||
          err.error?.errorCode?.code === "ZeroContribution",
        `Unexpected error: ${err.message}`
      );
    }
  });

  // ── Test 5: reject release_milestone when goal not met ────────────────────
  it("rejects milestone release when goal is not met", async () => {
    try {
      await program.methods
        .releaseMilestone()
        .accounts({
          caller: creator.publicKey,
          campaign: campaignPDA,
          vault: vaultPDA,
          beneficiaryUsdcAta: beneficiaryUsdcAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([creator])
        .rpc();
      assert.fail("Expected GoalNotMet error");
    } catch (err: any) {
      assert.ok(
        err.message.includes("GoalNotMet") ||
          err.error?.errorCode?.code === "GoalNotMet",
        `Unexpected error: ${err.message}`
      );
    }
  });

  // ── Test 6: reject refund before deadline ─────────────────────────────────
  it("rejects refund before the deadline", async () => {
    try {
      await program.methods
        .claimRefund()
        .accounts({
          donor: donor.publicKey,
          campaign: campaignPDA,
          vault: vaultPDA,
          donorUsdcAta: donorUsdcAta,
          donorState: donorStatePDA,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([donor])
        .rpc();
      assert.fail("Expected DeadlineNotReached error");
    } catch (err: any) {
      assert.ok(
        err.message.includes("DeadlineNotReached") ||
          err.error?.errorCode?.code === "DeadlineNotReached",
        `Unexpected error: ${err.message}`
      );
    }
  });

  // ── Test 7: full funding + milestone release ──────────────────────────────
  it("releases milestone 0 (50%) after campaign goal is fully funded", async () => {
    // Fund remaining 85 USDC to reach 100 USDC goal (15 already contributed).
    const remaining = ONE_USDC.muln(85);
    await program.methods
      .contribute(remaining)
      .accounts({
        donor: donor.publicKey,
        campaign: campaignPDA,
        donorUsdcAta: donorUsdcAta,
        vault: vaultPDA,
        donorState: donorStatePDA,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([donor])
      .rpc();

    const campaignBefore = await program.account.campaignState.fetch(campaignPDA);
    assert.ok(
      campaignBefore.totalRaised.gte(campaignBefore.goal),
      "total raised should be >= goal after full funding"
    );

    const beneficiaryBalanceBefore = (
      await getAccount(connection, beneficiaryUsdcAta)
    ).amount;

    // Release milestone 0 (50% of 100 USDC = 50 USDC).
    const tx = await program.methods
      .releaseMilestone()
      .accounts({
        caller: creator.publicKey,
        campaign: campaignPDA,
        vault: vaultPDA,
        beneficiaryUsdcAta: beneficiaryUsdcAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([creator])
      .rpc();
    console.log("  release_milestone tx:", tx);

    const beneficiaryBalanceAfter = (
      await getAccount(connection, beneficiaryUsdcAta)
    ).amount;
    const delta = beneficiaryBalanceAfter - beneficiaryBalanceBefore;
    const expectedPayout = BigInt(ONE_USDC.muln(50).toString()); // 50% of 100 USDC
    assert.strictEqual(
      delta,
      expectedPayout,
      `Expected payout of ${expectedPayout} but got ${delta}`
    );

    const campaignAfter = await program.account.campaignState.fetch(campaignPDA);
    assert.strictEqual(campaignAfter.milestonesReleased, 1);
  });

  // ── Test 8: release milestone 1 (30%) ─────────────────────────────────────
  it("releases milestone 1 (30 USDC)", async () => {
    const beneficiaryBalanceBefore = (
      await getAccount(connection, beneficiaryUsdcAta)
    ).amount;

    await program.methods
      .releaseMilestone()
      .accounts({
        caller: creator.publicKey,
        campaign: campaignPDA,
        vault: vaultPDA,
        beneficiaryUsdcAta: beneficiaryUsdcAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([creator])
      .rpc();

    const beneficiaryBalanceAfter = (
      await getAccount(connection, beneficiaryUsdcAta)
    ).amount;
    const delta = beneficiaryBalanceAfter - beneficiaryBalanceBefore;
    const expectedPayout = BigInt(ONE_USDC.muln(30).toString()); // 30% of 100 USDC
    assert.strictEqual(delta, expectedPayout);

    const campaign = await program.account.campaignState.fetch(campaignPDA);
    assert.strictEqual(campaign.milestonesReleased, 2);
  });

  // ── Test 9: failed campaign refund flow ───────────────────────────────────
  it("allows donor refund on a separate failed campaign after deadline", async () => {
    // Create a new campaign with a very short deadline (1 second).
    const failCampaignId = new BN(Date.now() + 1);
    const [failCampaignPDA] = deriveCampaignPDA(
      program.programId,
      creator.publicKey,
      failCampaignId
    );
    const [failVaultPDA] = deriveVaultPDA(program.programId, failCampaignPDA);
    const [failDonorStatePDA] = deriveDonorStatePDA(
      program.programId,
      failCampaignPDA,
      donor.publicKey
    );

    const goal = ONE_USDC.muln(10_000); // Very high goal — will never be met.
    const deadline = new BN(Math.floor(Date.now() / 1000) + 2); // 2 seconds from now.

    await program.methods
      .initializeCampaign(
        goal,
        deadline,
        [100], // Single milestone
        beneficiary.publicKey,
        failCampaignId
      )
      .accounts({
        creator: creator.publicKey,
        usdcMint: mockUsdcMint,
        campaign: failCampaignPDA,
        vault: failVaultPDA,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .signers([creator])
      .rpc();

    // Donor contributes 20 USDC.
    await program.methods
      .contribute(ONE_USDC.muln(20))
      .accounts({
        donor: donor.publicKey,
        campaign: failCampaignPDA,
        donorUsdcAta: donorUsdcAta,
        vault: failVaultPDA,
        donorState: failDonorStatePDA,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([donor])
      .rpc();

    const donorBalanceBefore = (await getAccount(connection, donorUsdcAta)).amount;

    // Wait for deadline to pass (3 seconds).
    console.log("  Waiting 3s for deadline to expire...");
    await new Promise((r) => setTimeout(r, 3_000));

    // Claim refund.
    const tx = await program.methods
      .claimRefund()
      .accounts({
        donor: donor.publicKey,
        campaign: failCampaignPDA,
        vault: failVaultPDA,
        donorUsdcAta: donorUsdcAta,
        donorState: failDonorStatePDA,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      })
      .signers([donor])
      .rpc();
    console.log("  claim_refund tx:", tx);

    const donorBalanceAfter = (await getAccount(connection, donorUsdcAta)).amount;
    const refundReceived = donorBalanceAfter - donorBalanceBefore;
    assert.strictEqual(
      refundReceived,
      BigInt(ONE_USDC.muln(20).toString()),
      "Should have received 20 USDC refund"
    );

    // DonorState account should be closed (throws AccountNotFoundError).
    try {
      await program.account.donorState.fetch(failDonorStatePDA);
      assert.fail("DonorState should have been closed");
    } catch (err: any) {
      assert.ok(
        err.message.includes("Account does not exist") ||
          err.message.includes("does not exist"),
        "Expected account-not-found error after close"
      );
    }
  });

  // ── Test 10: unauthorized milestone release rejected ──────────────────────
  it("rejects milestone release from an unauthorized caller", async () => {
    const intruder = Keypair.generate();
    const intruderSig = await connection.requestAirdrop(
      intruder.publicKey,
      1_000_000_000
    );
    await connection.confirmTransaction(intruderSig, "confirmed");

    try {
      await program.methods
        .releaseMilestone()
        .accounts({
          caller: intruder.publicKey,
          campaign: campaignPDA,
          vault: vaultPDA,
          beneficiaryUsdcAta: beneficiaryUsdcAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        })
        .signers([intruder])
        .rpc();
      assert.fail("Expected Unauthorized error");
    } catch (err: any) {
      assert.ok(
        err.message.includes("Unauthorized") ||
          err.error?.errorCode?.code === "Unauthorized",
        `Unexpected error: ${err.message}`
      );
    }
  });
});
