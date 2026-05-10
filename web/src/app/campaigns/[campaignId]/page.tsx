"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { PublicKey } from "@solana/web3.js";
import { WalletButton } from "@/components/wallet-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { ContributeForm } from "@/components/contribute-form";
import { MilestonePanel } from "@/components/milestone-panel";
import { RefundButton } from "@/components/refund-button";
import { DonateViaApi } from "@/components/donate-via-api";
import { VoicePitchPlayer } from "@/components/voice-pitch-player";
import { CelebrationIllustration } from "@/components/illustrations/CelebrationIllustration";
import { useCampaign } from "@/hooks/use-campaigns";
import { formatUsdc, progressPct, formatDeadline, isDeadlinePassed, shortAddress } from "@/lib/utils";
import { PROGRAM_ID, VAULT_SEED } from "@/lib/constants";
import { ArrowLeft, ExternalLink, Clock, User, Users, Flag } from "lucide-react";
import BN from "bn.js";

interface PageProps {
  params: Promise<{ campaignId: string }>;
}

export default function CampaignDetailPage({ params }: PageProps) {
  const { campaignId } = use(params);
  const { data: campaign, isLoading, error } = useCampaign(campaignId);

  const [meta, setMeta] = useState<{ title?: string; description?: string; voicePitch?: string } | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`solfund-meta-${campaignId}`);
      if (raw) setMeta(JSON.parse(raw));
    } catch { /* storage unavailable */ }
  }, [campaignId]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-pulse border-2" style={{ background: "var(--primary-light)", borderColor: "var(--primary)" }} />
          <p className="text-base animate-pulse" style={{ color: "var(--text-muted)" }}>Loading campaign…</p>
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="card text-center px-10 py-12 max-w-sm">
          <p className="text-lg font-bold mb-2" style={{ color: "var(--text)" }}>Campaign not found</p>
          <p className="text-base mb-6" style={{ color: "var(--text-muted)" }}>This address doesn&apos;t match any on-chain campaign.</p>
          <Link href="/campaigns" className="text-base font-bold hover:underline" style={{ color: "var(--primary)" }}>← Back to campaigns</Link>
        </div>
      </div>
    );
  }

  const c = campaign as {
    creator: PublicKey; beneficiary: PublicKey; goal: BN; deadline: BN;
    totalRaised: BN; milestoneCount: number; milestonesReleased: number;
    milestonePercentages: number[]; campaignId: BN;
  };

  const campaignPDA = new PublicKey(campaignId);
  const pct = progressPct(c.totalRaised, c.goal);
  const expired = isDeadlinePassed(c.deadline.toNumber());
  const goalMet = c.totalRaised.gte(c.goal);

  // Derive vault PDA client-side for the x402 component
  const [vaultPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from(VAULT_SEED), campaignPDA.toBuffer()],
    PROGRAM_ID
  );

  const statusStyle: React.CSSProperties = goalMet
    ? { background: "rgba(22,163,74,0.08)", color: "#16a34a", border: "1.5px solid rgba(22,163,74,0.3)" }
    : expired
    ? { background: "var(--surface-alt)", color: "var(--text-muted)", border: "1.5px solid var(--border)" }
    : { background: "var(--primary-light)", color: "var(--primary)", border: "1.5px solid rgba(224,90,66,0.35)" };
  const statusDot = goalMet ? "bg-green-500" : expired ? "bg-stone-400" : "bg-[var(--primary)]";
  const statusLabel = goalMet ? "Goal Met" : expired ? "Expired" : "Active";

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Navbar */}
      <nav className="sticky top-0 z-30" style={{ background: "var(--surface)", borderBottom: "2px solid var(--border)" }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/campaigns" className="inline-flex items-center gap-2 text-base font-bold hover:opacity-80 transition-opacity" style={{ color: "var(--text-muted)" }}>
            <ArrowLeft className="w-4 h-4" />All Campaigns
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <WalletButton />
          </div>
        </div>
      </nav>

      <div className="page-enter stagger max-w-3xl mx-auto px-4 sm:px-6 py-10 pb-20 space-y-5">

        {/* Goal-met banner */}
        {goalMet && (
          <div className="card p-5 flex items-center gap-4" style={{ borderColor: "rgba(22,163,74,0.4)", background: "rgba(22,163,74,0.05)" }}>
            <CelebrationIllustration className="w-20 h-20 shrink-0" />
            <div>
              <p className="text-xl font-black text-green-700 dark:text-green-400">Goal Reached! 🎉</p>
              <p className="text-base mt-1" style={{ color: "var(--text-muted)" }}>
                {formatUsdc(c.totalRaised)} USDC fully funded. Milestones can now be released.
              </p>
            </div>
          </div>
        )}

        {/* Header card */}
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-5">
            <span className="inline-flex items-center gap-1.5 text-sm font-bold px-3 py-1.5" style={statusStyle}>
              <span className={`h-2 w-2 rounded-full ${statusDot}`} />
              {statusLabel}
            </span>
            <a href={`https://solscan.io/account/${campaignId}?cluster=devnet`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium hover:underline" style={{ color: "var(--text-muted)" }}>
              <ExternalLink className="w-3.5 h-3.5" />Solscan
            </a>
            <span className="ml-auto text-sm font-mono" style={{ color: "var(--text-muted)" }}>
              {shortAddress(campaignId, 8)}
            </span>
          </div>

          {/* Amount */}
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <span className="text-5xl font-black" style={{ color: "var(--text)" }}>{formatUsdc(c.totalRaised)}</span>
              <span className="text-lg ml-2" style={{ color: "var(--text-muted)" }}>USDC raised</span>
            </div>
            <span className="text-base" style={{ color: "var(--text-muted)" }}>of {formatUsdc(c.goal)} goal</span>
          </div>

          {/* Progress bar */}
          <div className="h-4 overflow-hidden mb-2" style={{ background: "var(--surface-alt)", border: "1.5px solid var(--border)" }}>
            <div className="h-full transition-all duration-700"
              style={{ width: `${pct}%`, background: goalMet ? "#16a34a" : "var(--primary)" }} />
          </div>
          <div className="flex justify-between text-sm">
            <span className="font-black" style={{ color: "var(--text)" }}>{pct}% funded</span>
            <span className="flex items-center gap-1 font-medium" style={{ color: "var(--text-muted)" }}>
              <Clock className="w-4 h-4" />{formatDeadline(c.deadline.toNumber())}
            </span>
          </div>
        </div>

        {/* Off-chain title (if set at creation time) */}
        {meta?.title && (
          <p className="text-2xl font-black" style={{ color: "var(--text)" }}>{meta.title}</p>
        )}

        {/* Off-chain description */}
        {meta?.description && (
          <p className="text-base leading-relaxed -mt-2" style={{ color: "var(--text-muted)" }}>{meta.description}</p>
        )}

        {/* Voice pitch player */}
        {meta?.voicePitch && (
          <VoicePitchPlayer src={meta.voicePitch} label="🎙️ Hear from the creator" />
        )}

        {/* Metadata */}
        <div className="card p-5">
          <h3 className="label-warm mb-4">Campaign Details</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: <User className="w-3.5 h-3.5" />, label: "Creator",     value: c.creator.toBase58(),     href: `https://solscan.io/account/${c.creator.toBase58()}?cluster=devnet` },
              { icon: <Users className="w-3.5 h-3.5" />, label: "Beneficiary", value: c.beneficiary.toBase58(), href: `https://solscan.io/account/${c.beneficiary.toBase58()}?cluster=devnet` },
            ].map(({ icon, label, value, href }) => (
              <div key={label} className="p-3 border" style={{ background: "var(--surface-alt)", borderColor: "var(--border)" }}>
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>
                  {icon} {label}
                </div>
                <a href={href} target="_blank" rel="noopener noreferrer"
                  className="font-mono text-sm font-medium hover:underline" style={{ color: "var(--text)" }}>
                  {shortAddress(value)}
                </a>
              </div>
            ))}
            <div className="p-3 border" style={{ background: "var(--surface-alt)", borderColor: "var(--border)" }}>
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>
                <Flag className="w-3.5 h-3.5" /> Milestones
              </div>
              <p className="text-base font-black" style={{ color: "var(--text)" }}>
                {c.milestonesReleased}
                <span className="font-normal text-sm" style={{ color: "var(--text-muted)" }}>/{c.milestoneCount} released</span>
              </p>
            </div>
            <div className="p-3 border" style={{ background: "var(--surface-alt)", borderColor: "var(--border)" }}>
              <div className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>Campaign ID</div>
              <p className="font-mono text-sm truncate" style={{ color: "var(--text-muted)" }}>{c.campaignId.toString()}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <ContributeForm campaignPDA={campaignPDA} isExpired={expired} />
        <MilestonePanel
          campaignPDA={campaignPDA} creator={c.creator} beneficiary={c.beneficiary}
          goal={c.goal} totalRaised={c.totalRaised} milestoneCount={c.milestoneCount}
          milestonesReleased={c.milestonesReleased}
          milestonePercentages={Array.from(c.milestonePercentages)}
        />
        <RefundButton campaignPDA={campaignPDA} goalMet={goalMet} deadline={c.deadline} />

        {/* x402 */}
        <DonateViaApi campaignId={campaignId} vaultAddress={vaultPDA.toBase58()} />
      </div>
    </div>
  );
}
