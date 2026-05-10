"use client";

import { use } from "react";
import Link from "next/link";
import { PublicKey } from "@solana/web3.js";
import { WalletButton } from "@/components/wallet-button";
import { ContributeForm } from "@/components/contribute-form";
import { MilestonePanel } from "@/components/milestone-panel";
import { RefundButton } from "@/components/refund-button";
import { CelebrationIllustration } from "@/components/illustrations/CelebrationIllustration";
import { useCampaign } from "@/hooks/use-campaigns";
import { formatUsdc, progressPct, formatDeadline, isDeadlinePassed, shortAddress } from "@/lib/utils";
import { ArrowLeft, ExternalLink, Clock, User, Users, Flag } from "lucide-react";
import BN from "bn.js";

interface PageProps {
  params: Promise<{ campaignId: string }>;
}

export default function CampaignDetailPage({ params }: PageProps) {
  const { campaignId } = use(params);
  const { data: campaign, isLoading, error } = useCampaign(campaignId);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fdfcf8] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-2xl bg-[#fde8e4] border-2 border-[#e05a42]/30 animate-pulse" />
          <p className="text-stone-400 text-sm animate-pulse">Loading campaign…</p>
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="min-h-screen bg-[#fdfcf8] flex items-center justify-center">
        <div className="card text-center px-10 py-12 max-w-sm">
          <p className="font-bold text-stone-600 mb-2">Campaign not found</p>
          <p className="text-stone-400 text-sm mb-6">This address doesn&apos;t match any on-chain campaign.</p>
          <Link href="/campaigns" className="text-sm text-[#e05a42] hover:underline font-medium">
            ← Back to campaigns
          </Link>
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

  const statusBg = goalMet ? "bg-green-50 text-green-700 border-green-200"
    : expired ? "bg-stone-100 text-stone-500 border-stone-200"
    : "bg-[#fde8e4] text-[#e05a42] border-[#f5c4bb]";
  const statusDot = goalMet ? "bg-green-500" : expired ? "bg-stone-400" : "bg-[#e05a42]";
  const statusLabel = goalMet ? "Goal Met" : expired ? "Expired" : "Active";

  return (
    <div className="min-h-screen bg-[#fdfcf8]">
      {/* Navbar */}
      <nav className="sticky top-0 z-30 bg-white/90 backdrop-blur-sm border-b border-[#ede8e2]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/campaigns" className="inline-flex items-center gap-2 text-stone-500 hover:text-[#1c1917] transition-colors text-sm font-medium">
            <ArrowLeft className="w-4 h-4" />
            All Campaigns
          </Link>
          <WalletButton />
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 pb-20 space-y-5">

        {/* ── Goal-met celebration banner ── */}
        {goalMet && (
          <div className="card border-green-200 bg-green-50 p-5 flex items-center gap-4">
            <CelebrationIllustration className="w-20 h-20 shrink-0" />
            <div>
              <p className="font-black text-green-700 text-lg">Goal Reached! 🎉</p>
              <p className="text-green-600 text-sm">
                This campaign fully funded {formatUsdc(c.totalRaised)} USDC.
                Milestones can now be released.
              </p>
            </div>
          </div>
        )}

        {/* ── Campaign header ── */}
        <div className="card p-6">
          {/* Status row */}
          <div className="flex items-center gap-3 mb-5">
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${statusBg}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
              {statusLabel}
            </span>
            <a
              href={`https://solscan.io/account/${campaignId}?cluster=devnet`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-stone-400 hover:text-[#e05a42] transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              Solscan
            </a>
            <span className="ml-auto text-xs text-stone-400 font-mono">
              {shortAddress(campaignId, 8)}
            </span>
          </div>

          {/* Amounts */}
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <span className="text-4xl font-black text-[#1c1917]">
                {formatUsdc(c.totalRaised)}
              </span>
              <span className="text-stone-400 ml-2 text-sm">USDC raised</span>
            </div>
            <span className="text-stone-400 text-sm">of {formatUsdc(c.goal)} goal</span>
          </div>

          {/* Progress bar */}
          <div className="h-3 rounded-full bg-stone-100 overflow-hidden mb-2">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${pct}%`,
                background: goalMet ? "#16a34a" : "#e05a42",
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-stone-400">
            <span className="font-semibold text-stone-500">{pct}% funded</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDeadline(c.deadline.toNumber())}
            </span>
          </div>
        </div>

        {/* ── Metadata ── */}
        <div className="card p-5">
          <h3 className="label-warm mb-4">Campaign Details</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: <User className="w-3 h-3" />, label: "Creator", value: c.creator.toBase58(), href: `https://solscan.io/account/${c.creator.toBase58()}?cluster=devnet` },
              { icon: <Users className="w-3 h-3" />, label: "Beneficiary", value: c.beneficiary.toBase58(), href: `https://solscan.io/account/${c.beneficiary.toBase58()}?cluster=devnet` },
            ].map(({ icon, label, value, href }) => (
              <div key={label} className="rounded-xl border border-[#ede8e2] bg-stone-50 px-4 py-3">
                <div className="flex items-center gap-1.5 text-[11px] text-stone-400 mb-1.5">
                  {icon} {label}
                </div>
                <a href={href} target="_blank" rel="noopener noreferrer"
                  className="font-mono text-xs text-stone-600 hover:text-[#e05a42] transition-colors">
                  {shortAddress(value)}
                </a>
              </div>
            ))}
            <div className="rounded-xl border border-[#ede8e2] bg-stone-50 px-4 py-3">
              <div className="flex items-center gap-1.5 text-[11px] text-stone-400 mb-1.5">
                <Flag className="w-3 h-3" /> Milestones
              </div>
              <div className="text-sm font-bold text-[#1c1917]">
                {c.milestonesReleased}
                <span className="text-stone-400 font-normal">/{c.milestoneCount} released</span>
              </div>
            </div>
            <div className="rounded-xl border border-[#ede8e2] bg-stone-50 px-4 py-3">
              <div className="text-[11px] text-stone-400 mb-1.5">Campaign ID</div>
              <div className="font-mono text-xs text-stone-500 truncate">{c.campaignId.toString()}</div>
            </div>
          </div>
        </div>

        {/* ── Actions ── */}
        <ContributeForm campaignPDA={campaignPDA} isExpired={expired} />
        <MilestonePanel
          campaignPDA={campaignPDA} creator={c.creator} beneficiary={c.beneficiary}
          goal={c.goal} totalRaised={c.totalRaised} milestoneCount={c.milestoneCount}
          milestonesReleased={c.milestonesReleased}
          milestonePercentages={Array.from(c.milestonePercentages)}
        />
        <RefundButton campaignPDA={campaignPDA} goalMet={goalMet} deadline={c.deadline} />
      </div>
    </div>
  );
}
