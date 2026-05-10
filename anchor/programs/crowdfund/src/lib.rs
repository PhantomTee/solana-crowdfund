#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{self, Mint, Token, TokenAccount, Transfer},
};

declare_id!("Eu8KcpvnwgpaDw6UsMgRCV29SYmEgESXoLxTEcAhK6Nm");

// ─── Constants ────────────────────────────────────────────────────────────────
pub const MAX_MILESTONES: usize = 10;
pub const CAMPAIGN_SEED: &[u8] = b"campaign";
pub const DONOR_SEED: &[u8] = b"donor";
pub const VAULT_SEED: &[u8] = b"vault";

// ─── Program ──────────────────────────────────────────────────────────────────
#[program]
pub mod crowdfund {
    use super::*;

    // ── 1. initialize_campaign ────────────────────────────────────────────────
    /// Creates a CampaignState PDA and a USDC vault token account.
    /// The creator specifies a funding goal (in USDC base units), a Unix
    /// timestamp deadline, a list of milestone release percentages that must
    /// sum to exactly 100, and the beneficiary wallet.
    pub fn initialize_campaign(
        ctx: Context<InitializeCampaign>,
        goal: u64,
        deadline: i64,
        milestone_percentages: Vec<u8>,
        beneficiary: Pubkey,
        campaign_id: u64,
    ) -> Result<()> {
        require!(goal > 0, CrowdfundError::InvalidGoal);

        let clock = Clock::get()?;
        require!(
            deadline > clock.unix_timestamp,
            CrowdfundError::DeadlineMustBeFuture
        );

        require!(
            !milestone_percentages.is_empty()
                && milestone_percentages.len() <= MAX_MILESTONES,
            CrowdfundError::InvalidMilestoneCount
        );

        // Verify percentages sum to exactly 100 with overflow protection.
        let sum: u16 = milestone_percentages
            .iter()
            .fold(0u16, |acc, &x| acc + x as u16);
        require!(sum == 100, CrowdfundError::MilestonesMustSum100);

        // Populate state.
        let campaign = &mut ctx.accounts.campaign;
        campaign.creator = ctx.accounts.creator.key();
        campaign.beneficiary = beneficiary;
        campaign.usdc_mint = ctx.accounts.usdc_mint.key();
        campaign.goal = goal;
        campaign.deadline = deadline;
        campaign.total_raised = 0;
        campaign.campaign_id = campaign_id;
        campaign.milestone_count = milestone_percentages.len() as u8;
        campaign.milestones_released = 0;

        // Copy percentages into fixed-size array (remaining slots stay 0).
        let mut pcts = [0u8; MAX_MILESTONES];
        for (i, &p) in milestone_percentages.iter().enumerate() {
            pcts[i] = p;
        }
        campaign.milestone_percentages = pcts;
        campaign.bump = ctx.bumps.campaign;
        campaign.vault_bump = ctx.bumps.vault;

        Ok(())
    }

    // ── 2. contribute ─────────────────────────────────────────────────────────
    /// Transfers USDC from the donor's ATA to the campaign vault.
    /// Creates or updates a DonorState PDA tracking the total donated.
    pub fn contribute(ctx: Context<Contribute>, amount: u64) -> Result<()> {
        require!(amount > 0, CrowdfundError::ZeroContribution);

        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp < ctx.accounts.campaign.deadline,
            CrowdfundError::CampaignExpired
        );

        // CPI: donor ATA → vault (donor is the signer/authority).
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.donor_usdc_ata.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.donor.to_account_info(),
                },
            ),
            amount,
        )?;

        // Accumulate in DonorState (init_if_needed handled by constraint).
        let donor_state = &mut ctx.accounts.donor_state;
        if donor_state.donor == Pubkey::default() {
            // First contribution: initialise fields.
            donor_state.donor = ctx.accounts.donor.key();
            donor_state.campaign = ctx.accounts.campaign.key();
            donor_state.bump = ctx.bumps.donor_state;
        }
        donor_state.amount = donor_state
            .amount
            .checked_add(amount)
            .ok_or(CrowdfundError::AmountOverflow)?;

        // Update campaign total.
        let campaign = &mut ctx.accounts.campaign;
        campaign.total_raised = campaign
            .total_raised
            .checked_add(amount)
            .ok_or(CrowdfundError::AmountOverflow)?;

        Ok(())
    }

    // ── 3. release_milestone ──────────────────────────────────────────────────
    /// Releases the next milestone tranche from the vault to the beneficiary.
    /// Only the campaign creator or beneficiary may call this.
    /// Requires the funding goal to have been fully met first.
    pub fn release_milestone(ctx: Context<ReleaseMilestone>) -> Result<()> {
        let campaign = &ctx.accounts.campaign;

        // Authorization: creator or beneficiary only.
        let caller = ctx.accounts.caller.key();
        require!(
            caller == campaign.creator || caller == campaign.beneficiary,
            CrowdfundError::Unauthorized
        );

        // Goal must be met.
        require!(
            campaign.total_raised >= campaign.goal,
            CrowdfundError::GoalNotMet
        );

        // Milestones must remain.
        require!(
            campaign.milestones_released < campaign.milestone_count,
            CrowdfundError::AllMilestonesReleased
        );

        // Calculate payout from total goal x current milestone percentage.
        let pct = campaign.milestone_percentages[campaign.milestones_released as usize] as u64;
        let payout = campaign
            .goal
            .checked_mul(pct)
            .ok_or(CrowdfundError::AmountOverflow)?
            .checked_div(100)
            .ok_or(CrowdfundError::AmountOverflow)?;

        // Capture values before mutable borrow.
        let campaign_key = ctx.accounts.campaign.key();
        let vault_bump = campaign.vault_bump;

        // PDA signer seeds for the vault token account.
        let vault_seeds: &[&[u8]] = &[VAULT_SEED, campaign_key.as_ref(), &[vault_bump]];
        let signer_seeds = &[vault_seeds];

        // CPI: vault → beneficiary ATA using vault PDA as authority.
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.beneficiary_usdc_ata.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                signer_seeds,
            ),
            payout,
        )?;

        // Advance milestone counter.
        let campaign = &mut ctx.accounts.campaign;
        campaign.milestones_released = campaign
            .milestones_released
            .checked_add(1)
            .ok_or(CrowdfundError::AmountOverflow)?;

        Ok(())
    }

    // ── 4. claim_refund ───────────────────────────────────────────────────────
    /// Allows a donor to reclaim their USDC after a failed campaign.
    /// Conditions: deadline has passed AND total raised is below goal.
    /// The DonorState PDA is closed (rent returned to donor) to prevent
    /// double-claiming.
    pub fn claim_refund(ctx: Context<ClaimRefund>) -> Result<()> {
        let campaign = &ctx.accounts.campaign;
        let clock = Clock::get()?;

        // Deadline must have passed.
        require!(
            clock.unix_timestamp >= campaign.deadline,
            CrowdfundError::DeadlineNotReached
        );

        // Goal must NOT have been met.
        require!(
            campaign.total_raised < campaign.goal,
            CrowdfundError::GoalWasMet
        );

        let refund_amount = ctx.accounts.donor_state.amount;
        require!(refund_amount > 0, CrowdfundError::NothingToRefund);

        // Capture values before mutable borrow.
        let campaign_key = ctx.accounts.campaign.key();
        let vault_bump = campaign.vault_bump;

        let vault_seeds: &[&[u8]] = &[VAULT_SEED, campaign_key.as_ref(), &[vault_bump]];
        let signer_seeds = &[vault_seeds];

        // CPI: vault → donor ATA.
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.donor_usdc_ata.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                signer_seeds,
            ),
            refund_amount,
        )?;

        // donor_state is closed via `close = donor` in the account constraint,
        // which zeroes the account, reclaims rent, and prevents re-use.
        Ok(())
    }
}

// ─── Account Contexts ─────────────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(goal: u64, deadline: i64, milestone_percentages: Vec<u8>,
              beneficiary: Pubkey, campaign_id: u64)]
pub struct InitializeCampaign<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    /// The USDC mint. Validated against devnet address in the UI; add an
    /// `address = USDC_DEVNET_MINT` constraint before mainnet deployment.
    pub usdc_mint: Account<'info, Mint>,

    /// CampaignState PDA -- one per (creator, campaign_id) pair.
    #[account(
        init,
        payer = creator,
        space = 8 + CampaignState::INIT_SPACE,
        seeds = [CAMPAIGN_SEED, creator.key().as_ref(), &campaign_id.to_le_bytes()],
        bump
    )]
    pub campaign: Account<'info, CampaignState>,

    /// USDC vault token account owned by the vault PDA (authority = self).
    #[account(
        init,
        payer = creator,
        token::mint = usdc_mint,
        token::authority = vault,
        seeds = [VAULT_SEED, campaign.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Contribute<'info> {
    #[account(mut)]
    pub donor: Signer<'info>,

    #[account(mut)]
    pub campaign: Account<'info, CampaignState>,

    /// Donor's USDC ATA -- source of funds.
    #[account(
        mut,
        associated_token::mint = campaign.usdc_mint,
        associated_token::authority = donor,
    )]
    pub donor_usdc_ata: Account<'info, TokenAccount>,

    /// Campaign vault -- destination of funds.
    #[account(
        mut,
        seeds = [VAULT_SEED, campaign.key().as_ref()],
        bump = campaign.vault_bump,
        token::mint = campaign.usdc_mint,
    )]
    pub vault: Account<'info, TokenAccount>,

    /// Per-donor contribution ledger. Created on first contribution.
    #[account(
        init_if_needed,
        payer = donor,
        space = 8 + DonorState::INIT_SPACE,
        seeds = [DONOR_SEED, campaign.key().as_ref(), donor.key().as_ref()],
        bump
    )]
    pub donor_state: Account<'info, DonorState>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReleaseMilestone<'info> {
    /// Creator OR beneficiary -- checked in handler body (Anchor can't express OR).
    pub caller: Signer<'info>,

    #[account(mut)]
    pub campaign: Account<'info, CampaignState>,

    #[account(
        mut,
        seeds = [VAULT_SEED, campaign.key().as_ref()],
        bump = campaign.vault_bump,
        token::mint = campaign.usdc_mint,
    )]
    pub vault: Account<'info, TokenAccount>,

    /// Beneficiary's USDC ATA -- payout destination.
    #[account(
        mut,
        associated_token::mint = campaign.usdc_mint,
        associated_token::authority = campaign.beneficiary,
    )]
    pub beneficiary_usdc_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct ClaimRefund<'info> {
    #[account(mut)]
    pub donor: Signer<'info>,

    /// Read-only: used for deadline/goal checks and vault PDA derivation.
    pub campaign: Account<'info, CampaignState>,

    #[account(
        mut,
        seeds = [VAULT_SEED, campaign.key().as_ref()],
        bump = campaign.vault_bump,
        token::mint = campaign.usdc_mint,
    )]
    pub vault: Account<'info, TokenAccount>,

    /// Donor's USDC ATA -- refund destination.
    #[account(
        mut,
        associated_token::mint = campaign.usdc_mint,
        associated_token::authority = donor,
    )]
    pub donor_usdc_ata: Account<'info, TokenAccount>,

    /// Donor's contribution record.
    /// has_one guards prevent passing the wrong DonorState.
    /// close = donor atomically closes the account post-refund.
    #[account(
        mut,
        seeds = [DONOR_SEED, campaign.key().as_ref(), donor.key().as_ref()],
        bump = donor_state.bump,
        has_one = donor @ CrowdfundError::Unauthorized,
        has_one = campaign @ CrowdfundError::Unauthorized,
        close = donor
    )]
    pub donor_state: Account<'info, DonorState>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

// ─── State Accounts ───────────────────────────────────────────────────────────

/// On-chain state for a single crowdfunding campaign.
/// Space: 8 discriminator + 142 data = 150 bytes total.
#[account]
#[derive(InitSpace)]
pub struct CampaignState {
    pub creator: Pubkey,                       // 32
    pub beneficiary: Pubkey,                   // 32
    pub usdc_mint: Pubkey,                     // 32
    pub goal: u64,                             // 8
    pub deadline: i64,                         // 8
    pub total_raised: u64,                     // 8
    pub campaign_id: u64,                      // 8
    pub milestone_count: u8,                   // 1
    pub milestones_released: u8,               // 1
    pub milestone_percentages: [u8; 10],       // 10
    pub bump: u8,                              // 1
    pub vault_bump: u8,                        // 1
                                               // total: 142
}

/// Per-donor contribution ledger tied to one campaign.
/// Space: 8 discriminator + 73 data = 81 bytes total.
#[account]
#[derive(InitSpace)]
pub struct DonorState {
    pub donor: Pubkey,    // 32
    pub campaign: Pubkey, // 32
    pub amount: u64,      // 8
    pub bump: u8,         // 1
                          // total: 73
}

// ─── Errors ───────────────────────────────────────────────────────────────────

#[error_code]
pub enum CrowdfundError {
    #[msg("Campaign goal must be greater than zero.")]
    InvalidGoal,
    #[msg("Deadline must be in the future.")]
    DeadlineMustBeFuture,
    #[msg("Deadline has not been reached yet -- refunds are not available.")]
    DeadlineNotReached,
    #[msg("Milestone count must be between 1 and 10.")]
    InvalidMilestoneCount,
    #[msg("Milestone percentages must sum to exactly 100.")]
    MilestonesMustSum100,
    #[msg("All milestones have already been released.")]
    AllMilestonesReleased,
    #[msg("Campaign goal has not been met -- milestones cannot be released yet.")]
    GoalNotMet,
    #[msg("Campaign goal was met -- refunds are not available.")]
    GoalWasMet,
    #[msg("Campaign deadline has passed -- contributions are no longer accepted.")]
    CampaignExpired,
    #[msg("Contribution amount must be greater than zero.")]
    ZeroContribution,
    #[msg("Nothing to refund for this donor.")]
    NothingToRefund,
    #[msg("Arithmetic overflow in amount calculation.")]
    AmountOverflow,
    #[msg("Caller is not authorized for this action.")]
    Unauthorized,
}
