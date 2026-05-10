"use client";

import Link from "next/link";
import { WalletButton } from "@/components/wallet-button";
import { CampaignCard } from "@/components/campaign-card";
import { Button } from "@/components/ui/button";
import { HeroIllustration } from "@/components/illustrations/HeroIllustration";
import { EmptyIllustration } from "@/components/illustrations/EmptyIllustration";
import { useCampaigns } from "@/hooks/use-campaigns";
import { CIRCLE_FAUCET_URL, SOLANA_FAUCET_URL } from "@/lib/constants";
import { ExternalLink, Plus, RefreshCw } from "lucide-react";

export default function CampaignsPage() {
  const { data: campaigns, isLoading, error, refetch, isRefetching } = useCampaigns();

  const totalCampaigns = campaigns?.length ?? 0;
  const activeCampaigns = campaigns?.filter((c: { account: { totalRaised: { gte: (g: unknown) => boolean }; goal: unknown; deadline: { toNumber(): number } } }) => {
    const a = c.account;
    return !a.totalRaised.gte(a.goal) && a.deadline.toNumber() > Date.now() / 1000;
  }).length ?? 0;
  const fundedCampaigns = campaigns?.filter((c: { account: { totalRaised: { gte: (g: unknown) => boolean }; goal: unknown } }) =>
    c.account.totalRaised.gte(c.account.goal)
  ).length ?? 0;

  return (
    <div className="min-h-screen bg-[#fdfcf8]">
      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-30 bg-white/90 backdrop-blur-sm border-b border-[#ede8e2]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/campaigns" className="flex items-center gap-2.5">
            {/* Logo mark */}
            <div className="h-8 w-8 rounded-xl bg-[#e05a42] flex items-center justify-center shadow-sm">
              <svg viewBox="0 0 20 20" fill="none" className="w-4.5 h-4.5" aria-hidden="true">
                <path d="M10 3 L17 7 L17 13 L10 17 L3 13 L3 7 Z" stroke="white" strokeWidth="1.8" strokeLinejoin="round"/>
                <path d="M10 7 L10 13 M7 9 L13 11" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="font-black text-xl text-[#1c1917] tracking-tight">SolFund</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/campaigns/create">
              <Button size="sm">
                <Plus className="w-3.5 h-3.5" />
                New Campaign
              </Button>
            </Link>
            <WalletButton />
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* ── Hero ── */}
        <div className="flex flex-col md:flex-row items-center gap-8 py-16 md:py-20">
          {/* Left: text */}
          <div className="flex-1 text-center md:text-left">
            <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-[#fde8e4] text-[#e05a42] mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-[#e05a42]" />
              Solana Devnet · USDC Escrow
            </div>
            <h1 className="text-5xl sm:text-6xl font-black text-[#1c1917] leading-[1.05] tracking-tight mb-5">
              Fund what{" "}
              <span className="relative inline-block">
                matters
                <svg
                  className="absolute -bottom-1 left-0 w-full"
                  viewBox="0 0 120 8"
                  fill="none"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2 6 Q30 2 60 5 Q90 8 118 4"
                    stroke="#e05a42"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </h1>
            <p className="text-stone-500 max-w-md mx-auto md:mx-0 text-base leading-relaxed mb-8">
              Milestone-based USDC escrow on Solana. Funds only release when
              goals are met — donors get automatic refunds if they&apos;re not.
            </p>

            <div className="flex flex-wrap justify-center md:justify-start gap-4 text-sm">
              <a
                href={CIRCLE_FAUCET_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[#e05a42] font-medium hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Get Devnet USDC
              </a>
              <a
                href={SOLANA_FAUCET_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-stone-400 hover:text-stone-600 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Get Devnet SOL
              </a>
            </div>
          </div>

          {/* Right: illustration */}
          <div className="flex-shrink-0 w-full max-w-sm md:max-w-xs lg:max-w-sm">
            <div className="relative">
              <div className="absolute inset-0 bg-[#fde8e4] rounded-3xl scale-95 translate-y-3" />
              <div className="relative bg-white rounded-3xl border border-[#ede8e2] shadow-sm p-6">
                <HeroIllustration className="w-full" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Stats ── */}
        {totalCampaigns > 0 && (
          <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mb-12">
            {[
              { label: "Total", value: totalCampaigns },
              { label: "Active", value: activeCampaigns },
              { label: "Funded", value: fundedCampaigns },
            ].map((s) => (
              <div key={s.label} className="card text-center px-3 py-4">
                <div className="text-3xl font-black text-[#e05a42] mb-0.5">{s.value}</div>
                <div className="text-[11px] text-stone-400 font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Toolbar ── */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-black text-[#1c1917] text-lg">
            All Campaigns
            {campaigns && (
              <span className="ml-2 text-sm font-normal text-stone-400">({campaigns.length})</span>
            )}
          </h2>
          <Button variant="ghost" size="sm" onClick={() => refetch()} loading={isRefetching}>
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>

        {/* ── Grid ── */}
        <div className="pb-20">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-52 rounded-2xl bg-stone-100 animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="card text-center py-16">
              <p className="font-semibold text-stone-600 mb-1">Failed to load campaigns</p>
              <p className="text-xs text-stone-400">{(error as Error).message}</p>
            </div>
          ) : !campaigns?.length ? (
            <div className="card text-center py-16 max-w-sm mx-auto">
              <EmptyIllustration className="w-40 mx-auto mb-6" />
              <p className="font-bold text-[#1c1917] mb-1">No campaigns yet</p>
              <p className="text-stone-400 text-sm mb-6">Be the first to launch one.</p>
              <Link href="/campaigns/create">
                <Button>
                  <Plus className="w-4 h-4" />
                  Create Campaign
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {campaigns.map((c: { publicKey: { toBase58(): string }; account: Parameters<typeof CampaignCard>[0]["account"] }) => (
                <CampaignCard
                  key={c.publicKey.toBase58()}
                  publicKey={c.publicKey.toBase58()}
                  account={c.account}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
