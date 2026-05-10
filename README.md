# SolFund

A crowdfunding dApp on Solana Devnet. Campaigns are all-or-nothing: USDC raised sits in an on-chain vault, milestones release tranches to the beneficiary only after the goal is met, and donors can claim full refunds if the deadline passes without hitting the goal. Everything — escrow, refunds, milestone releases — is enforced by the program, not by the frontend.

Live demo: https://solana-crowdfund-web.vercel.app  
Program ID: `Eu8KcpvnwgpaDw6UsMgRCV29SYmEgESXoLxTEcAhK6Nm` (Devnet)

---

## What's inside

| Layer | Stack |
|---|---|
| Smart contract | Rust, Anchor 0.32.1 |
| Token | Circle USDC Devnet (`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`) |
| Frontend | Next.js 15, App Router, TypeScript |
| Wallet | `@solana/wallet-adapter` (Phantom, Backpack, etc.) |
| State fetching | React Query v5 |
| Styling | Tailwind CSS, CSS custom properties, Bricolage Grotesque |
| Voice | ElevenLabs TTS (`eleven_turbo_v2_5`) |
| Agent reasoning | Heurist / OpenRouter (OpenAI-compatible) |
| Agent logging | Virtuals Terminal API |
| Payment protocol | x402 (HTTP 402 + `X-Payment` header) |

---

## Repository layout

```
solana-crowdfund/
├── anchor/
│   ├── programs/crowdfund/src/lib.rs   ← full program (4 instructions)
│   ├── tests/crowdfund.ts              ← Anchor/Mocha integration tests
│   └── Anchor.toml
└── web/
    ├── src/
    │   ├── app/
    │   │   ├── campaigns/              ← list, create, detail pages
    │   │   ├── agent/                  ← AI agent dashboard
    │   │   └── api/
    │   │       ├── agent/              ← balance, run, runs endpoints
    │   │       ├── campaigns/[id]/     ← x402 donate endpoint
    │   │       └── voice/              ← ElevenLabs TTS proxy
    │   ├── components/
    │   ├── hooks/                      ← use-campaigns, use-crowdfund-program
    │   └── lib/                        ← constants, agent-store, payment-store
    ├── .env.example
    └── next.config.ts
```

---

## Smart contract

### State accounts

**`CampaignState`** — PDA seeds: `["campaign", creator, campaign_id_le8]`  
Space: 150 bytes (8 discriminator + 142 data)

| Field | Type | Notes |
|---|---|---|
| `creator` | `Pubkey` | Wallet that called `initialize_campaign` |
| `beneficiary` | `Pubkey` | Receives milestone payouts (can differ from creator) |
| `usdc_mint` | `Pubkey` | Always the Circle USDC devnet mint |
| `goal` | `u64` | Target in micro-USDC (6 decimals) |
| `deadline` | `i64` | Unix timestamp; enforced via `Clock::get()` |
| `total_raised` | `u64` | Running sum of all contributions |
| `campaign_id` | `u64` | Caller-supplied ID (frontend uses `Date.now()`) |
| `milestone_count` | `u8` | 1–10 |
| `milestones_released` | `u8` | Incremented per `release_milestone` call |
| `milestone_percentages` | `[u8; 10]` | Percentages summing to 100 |
| `bump` / `vault_bump` | `u8` | Stored at init; used for PDA signing |

**`DonorState`** — PDA seeds: `["donor", campaign, donor]`  
Space: 81 bytes. Tracks per-donor total contributed. Closed atomically on `claim_refund`.

**Vault** — SPL Token Account PDA seeds: `["vault", campaign]`  
The vault is its own authority. Transfers out require the program to sign with `[VAULT_SEED, campaign.key(), &[vault_bump]]`.

---

### Instructions

#### `initialize_campaign(goal, deadline, milestone_percentages, beneficiary, campaign_id)`

Creates the `CampaignState` PDA and initialises the vault token account.

Checks:
- `goal > 0`
- `deadline > Clock::get().unix_timestamp`
- `1 <= milestone_percentages.len() <= 10`
- `sum(milestone_percentages) == 100` (checked u16 arithmetic)

#### `contribute(amount)`

Transfers USDC from the donor's ATA to the vault via CPI. Creates the `DonorState` PDA on first contribution (`init_if_needed`).

Checks:
- `amount > 0`
- `Clock::get().unix_timestamp < campaign.deadline`

#### `release_milestone()`

Transfers the next milestone tranche from the vault to the beneficiary's USDC ATA.  
Payout = `goal * milestone_percentages[milestones_released] / 100`

Checks:
- Caller is `campaign.creator` OR `campaign.beneficiary` (checked in handler body — Anchor constraints can't express OR)
- `total_raised >= goal`
- `milestones_released < milestone_count`

The CPI uses PDA signer seeds: `[VAULT_SEED, campaign.key().as_ref(), &[campaign.vault_bump]]`.

If the beneficiary has never received USDC their ATA won't exist. The frontend prepends a `createAssociatedTokenAccountInstruction` via Anchor's `.preInstructions([])` so the whole thing lands in one transaction.

#### `claim_refund()`

Returns the donor's full contribution from the vault.

Checks:
- `Clock::get().unix_timestamp >= campaign.deadline`
- `total_raised < campaign.goal`
- `donor_state.amount > 0`

The `DonorState` account has `close = donor` in its constraint, so the account is closed and its rent is returned in the same transaction. This prevents double-refund attempts at the program level.

---

### Error codes

`InvalidGoal` · `DeadlineMustBeFuture` · `DeadlineNotReached` · `InvalidMilestoneCount` · `MilestonesMustSum100` · `MilestoneOverflow` · `AllMilestonesReleased` · `GoalNotMet` · `GoalWasMet` · `CampaignExpired` · `ZeroContribution` · `NothingToRefund` · `AmountOverflow` · `Unauthorized`

---

## Frontend

### Campaign flow

1. **Create** — fill in goal (USDC), deadline, milestone split (e.g. 50/30/20), and optionally a title, description, and voice pitch script. The voice pitch is generated via ElevenLabs and stored as a base64 data-URI in `localStorage` under `solfund-meta-${campaignPDA}`.
2. **Browse** — the list page polls all `CampaignState` accounts every 30 seconds via React Query.
3. **Detail** — shows live progress, funding history (x402 payments), contributor state, milestone panel (creator/beneficiary only), refund button (expired campaigns, donors only), and the voice pitch player if one was recorded.

### Hooks

**`useCrowdfundProgram()`** (`web/src/hooks/use-crowdfund-program.ts`)  
Creates an `AnchorProvider` from the connected wallet and returns the typed `Program` plus three PDA derivation helpers: `deriveCampaignPDA`, `deriveVaultPDA`, `deriveDonorStatePDA`.

**`useCampaigns()` / `useCampaign()` / `useDonorState()`**  
React Query wrappers around `program.account.campaignState.all()` and `.fetch()`.

**`useCreateCampaign()` / `useContribute()` / `useReleaseMilestone()` / `useClaimRefund()`**  
Mutation hooks. Each one builds the correct account list, calls `.rpc()`, and invalidates the relevant query keys on success.

---

## API routes

### `GET /api/campaigns/[id]/donate`
Returns HTTP 402 with x402 payment-required headers pointing the caller to the campaign's vault PDA. This is what an x402-capable HTTP client hits first before paying.

Response headers include: `X-Payment-Required`, `X-Payment-Amount` (`1000000` micro-USDC), `X-Payment-Mint`, `X-Payment-Network`, `X-Payment-Recipient` (vault PDA).

### `POST /api/campaigns/[id]/donate`
Accepts header `X-Payment: <solana_tx_signature>`. Polls devnet up to ~12 seconds for confirmation, then verifies the vault's USDC balance increased by at least 1 USDC. Records the payment in the in-process `PaymentStore`. Returns the Solscan link.

### `GET /api/campaigns/[id]/payments`
Returns the payment feed for a specific campaign (used by the `DonateViaAPI` component on the detail page).

### `GET /api/agent/balance`
Returns the agent wallet's SOL and USDC balance, plus faucet URLs. The agent's public key comes from `AGENT_SOLANA_PUBLIC_KEY` in env.

### `POST /api/agent/run`
Triggers one agent donation cycle. There is a 60-second server-side cooldown enforced by `AgentStore.setLastRunTime()` — concurrent requests during cooldown get HTTP 429.

The run sequence:
1. Load agent keypair from `AGENT_SOLANA_SECRET_KEY` (base64-encoded 64-byte secret)
2. Exchange `VIRTUALS_API_KEY` for a Virtuals Terminal bearer token
3. Fetch all `CampaignState` accounts from devnet, filter to active (not funded, not expired)
4. Score each campaign: 50% funding momentum + 30% deadline urgency + 20% milestone count
5. Call the configured LLM (Heurist or OpenRouter) with a structured prompt asking it to pick one and explain why in 1–2 sentences. Falls back to the heuristic score if the LLM fails.
6. Verify the agent has ≥1 USDC; ensure its ATA exists (creates it if not)
7. Call `contribute(1_000_000)` via Anchor
8. Record the run in `AgentStore` and `PaymentStore` (with `source: "agent"`)

All six phases are streamed as log entries to the Virtuals Terminal (`https://api-terminal.virtuals.io/logs`).

### `GET /api/agent/runs`
Returns the full run history from `AgentStore`, optionally filtered by `?campaignId=`.

### `POST /api/voice/generate-pitch`
Proxies a text prompt to ElevenLabs (`eleven_turbo_v2_5`, voice Rachel by default). Returns the audio as `audio/mpeg`. The frontend converts it to a base64 data-URI and saves it to localStorage.

---

## In-process stores

`PaymentStore` and `AgentStore` are module-level singletons that survive for the lifetime of the Node.js server process. They use a `Map<txSig, record>` for deduplication. On Vercel (serverless), each function invocation gets its own process, so history resets between cold starts — this is intentional for a devnet prototype. A production version would replace these with a database.

---

## Local setup

### Prerequisites

- Node.js 20+
- Rust + Cargo (stable)
- Solana CLI (`solana config set --url devnet`)
- Anchor CLI 0.32.1 (`avm use 0.32.1`)
- A Phantom or Backpack wallet set to Devnet

### Running the frontend only

If you just want to run the web app against the already-deployed program:

```bash
cd web
cp .env.example .env.local
# fill in your keys (see Environment variables section)
npm install
npm run dev
```

Open http://localhost:3000. Get devnet USDC at https://faucet.circle.com and devnet SOL at https://faucet.solana.com.

### Rebuilding and redeploying the program

```bash
# From the repo root:
npm run anchor-build         # first run takes ~10 min (downloads SBF toolchain)
anchor keys list             # copy the program ID
# Update declare_id!() in anchor/programs/crowdfund/src/lib.rs
# Update [programs.devnet] in anchor/Anchor.toml
npm run anchor-build         # rebuild with the correct ID
anchor deploy --provider.cluster devnet

# Copy the generated files to the frontend:
cp anchor/target/idl/crowdfund.json web/src/lib/crowdfund-idl.json
cp anchor/target/types/crowdfund.ts web/src/lib/crowdfund.types.ts

# Update PROGRAM_ID in web/src/lib/constants.ts
```

### Running tests

```bash
npm run anchor-test
```

Tests cover: campaign initialisation, contribution tracking, milestone release and payout calculation, refund after expired deadline, and the main negative paths (zero contribution, release before goal, refund before deadline, double-refund on closed account).

---

## Environment variables

Copy `web/.env.example` to `web/.env.local` and fill in:

```
ELEVENLABS_API_KEY          # elevenlabs.io — free tier is enough
ELEVENLABS_VOICE_ID         # optional, defaults to Rachel (free)

HEURIST_API_KEY             # dev.heurist.ai — OR use OPENROUTER_API_KEY instead
# OPENROUTER_API_KEY

VIRTUALS_API_KEY            # app.virtuals.io — starts with "apt-"
VIRTUALS_SIGNER_PRIVATE_KEY # ECDSA P-256 PKCS#8 DER base64, generated with your agent

AGENT_SOLANA_PUBLIC_KEY     # base58 public key of the agent's donation wallet
AGENT_SOLANA_SECRET_KEY     # base64-encoded 64-byte secret key
```

The agent wallet needs to be funded before runs will succeed:
- SOL (for gas): https://faucet.solana.com
- USDC (for donations): https://faucet.circle.com — use the agent's public key as recipient

---

## Deploying to Vercel

1. Push to GitHub
2. Import the repo in Vercel
3. Set **Root Directory** to `web`
4. Add all environment variables from `.env.example` in the Vercel project settings
5. Deploy — framework is auto-detected as Next.js

The `outputFileTracingRoot` in `next.config.ts` is set to the monorepo root so Vercel can trace shared files correctly.

---

## Security notes

- Bump pinning: the vault's `bump` is stored in `CampaignState` at init time and reused for all subsequent PDA signing. The program never re-derives it.
- The `DonorState` PDA carries `has_one = donor` and `has_one = campaign` constraints, preventing a donor from claiming refunds from campaigns they didn't contribute to.
- `close = donor` on `claim_refund` closes the account in the same instruction that transfers tokens, making double-refund structurally impossible.
- All u64/u8 accumulations use checked arithmetic (`checked_add`).
- `release_milestone` does not use Anchor's `constraint` for the caller check because Anchor constraints can't express OR. The check is done explicitly in the instruction handler body.
- All timestamps come from `Clock::get()?.unix_timestamp` on-chain. Client timestamps are never trusted.
