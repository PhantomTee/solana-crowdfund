"use client";

import Link from "next/link";
import Image from "next/image";
import logo from "@/logo.png";
import { WalletButton } from "@/components/wallet-button";
import { CampaignCard } from "@/components/campaign-card";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { HeroIllustration } from "@/components/illustrations/HeroIllustration";
import { EmptyIllustration } from "@/components/illustrations/EmptyIllustration";
import { useCampaigns } from "@/hooks/use-campaigns";
import { CIRCLE_FAUCET_URL, SOLANA_FAUCET_URL } from "@/lib/constants";
import { ExternalLink, Plus, RefreshCw, SlidersHorizontal } from "lucide-react";
import { useState, useMemo } from "react";

type Filter = "all" | "active" | "funded" | "expired";
type Sort   = "newest" | "ending-soon" | "most-funded" | "least-funded";

export default function CampaignsPage() {
  const { data: campaigns, isLoading, error, refetch, isRefetching } = useCampaigns();

  const [filter, setFilter] = useState<Filter>("all");
  const [sort,   setSort]   = useState<Sort>("newest");

  const total  = campaigns?.length ?? 0;
  const nowSec = Date.now() / 1000;

  const active = campaigns?.filter((c: { account: { totalRaised: { gte: (g: unknown) => boolean }; goal: unknown; deadline: { toNumber(): number } } }) => {
    const a = c.account;
    return !a.totalRaised.gte(a.goal) && a.deadline.toNumber() > nowSec;
  }).length ?? 0;
  const funded = campaigns?.filter((c: { account: { totalRaised: { gte: (g: unknown) => boolean }; goal: unknown } }) =>
    c.account.totalRaised.gte(c.account.goal)
  ).length ?? 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const displayed = useMemo<any[]>(() => {
    if (!campaigns) return [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let list: any[] = [...campaigns];

    // ── Filter ──────────────────────────────────────────────────
    if (filter === "active") {
      list = list.filter(({ account: a }) =>
        !a.totalRaised.gte(a.goal) && a.deadline.toNumber() > nowSec
      );
    } else if (filter === "funded") {
      list = list.filter(({ account: a }) => a.totalRaised.gte(a.goal));
    } else if (filter === "expired") {
      list = list.filter(({ account: a }) =>
        a.deadline.toNumber() <= nowSec && !a.totalRaised.gte(a.goal)
      );
    }

    // ── Sort ─────────────────────────────────────────────────────
    list.sort((x, y) => {
      const a = x.account, b = y.account;
      if (sort === "newest")       return b.campaignId.toNumber() - a.campaignId.toNumber();
      if (sort === "ending-soon")  return a.deadline.toNumber()   - b.deadline.toNumber();
      if (sort === "most-funded")  return b.totalRaised.toNumber() - a.totalRaised.toNumber();
      if (sort === "least-funded") return a.totalRaised.toNumber() - b.totalRaised.toNumber();
      return 0;
    });

    return list;
  }, [campaigns, filter, sort, nowSec]);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* ── Navbar ── */}
      <nav style={{ background: "var(--surface)", borderBottom: "2px solid var(--border)" }}
        className="sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/campaigns" className="flex items-center shrink-0">
            <Image src={logo} alt="SolFund" height={44} className="w-auto" priority />
          </Link>

          <div className="flex items-center gap-2 ml-auto">
            <ThemeToggle />
            <Link href="/agent" className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold border transition-all hover:opacity-80" style={{ background: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text-muted)" }}>
              🤖 AI Agent
            </Link>
            <Link href="/campaigns/create">
              <Button size="sm"><Plus className="w-4 h-4" />New Campaign</Button>
            </Link>
            <WalletButton />
          </div>
        </div>
      </nav>

      <div className="page-enter max-w-6xl mx-auto px-4 sm:px-6">
        {/* ── Hero ── */}
        <div className="flex flex-col md:flex-row items-center gap-10 py-16 md:py-20">
          {/* Text */}
          <div className="flex-1 text-center md:text-left">
            <div className="inline-flex items-center gap-2 text-sm font-bold px-3 py-1.5 mb-6 border"
              style={{ background: "var(--primary-light)", color: "var(--primary)", borderColor: "rgba(224,90,66,0.4)" }}>
              <span className="h-2 w-2 rounded-full" style={{ background: "var(--primary)" }} />
              Solana Devnet · USDC Escrow
            </div>

            <h1 className="text-5xl sm:text-6xl font-black leading-[1.05] tracking-tight mb-5" style={{ color: "var(--text)" }}>
              Fund what{" "}
              <span className="relative inline-block">
                matters
                <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 120 8" fill="none" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M2 6 Q30 2 60 5 Q90 8 118 4" stroke="var(--primary)" strokeWidth="3.5" strokeLinecap="round"/>
                </svg>
              </span>
            </h1>
            <p className="text-lg max-w-md mx-auto md:mx-0 leading-relaxed mb-8" style={{ color: "var(--text-muted)" }}>
              Milestone-based USDC escrow on Solana. Funds only release when goals are
              met. Donors get automatic refunds if they&apos;re not.
            </p>

            <div className="flex flex-wrap justify-center md:justify-start gap-4 text-base">
              <a href={CIRCLE_FAUCET_URL} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-bold hover:underline" style={{ color: "var(--primary)" }}>
                <ExternalLink className="w-4 h-4" />Get Devnet USDC
              </a>
              <a href={SOLANA_FAUCET_URL} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-medium hover:underline" style={{ color: "var(--text-muted)" }}>
                <ExternalLink className="w-4 h-4" />Get Devnet SOL
              </a>
            </div>
          </div>

          {/* Illustration */}
          <div className="shrink-0 w-full max-w-sm md:max-w-xs lg:max-w-sm">
            <div className="relative">
              <div className="absolute inset-0 translate-x-2 translate-y-2" style={{ background: "var(--primary)", opacity: 0.15, border: "2px solid var(--primary)" }} />
              <div className="relative p-6 border-2" style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--card-shadow)" }}>
                <HeroIllustration className="w-full" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Stats ── */}
        {total > 0 && (
          <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mb-12">
            {[{ label: "Total", value: total }, { label: "Active", value: active }, { label: "Funded", value: funded }].map((s) => (
              <div key={s.label} className="card text-center px-3 py-4">
                <div className="text-3xl font-black mb-0.5" style={{ color: "var(--primary)" }}>{s.value}</div>
                <div className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Filter + Sort toolbar ── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">

          {/* Filter pills */}
          <div className="flex items-center gap-1 p-1 flex-wrap" style={{ background: "var(--surface)", border: "1.5px solid var(--border)" }}>
            <SlidersHorizontal className="w-3.5 h-3.5 ml-1 shrink-0" style={{ color: "var(--text-muted)" }} />
            {(["all", "active", "funded", "expired"] as Filter[]).map((f) => {
              const labels: Record<Filter, string> = { all: `All (${total})`, active: `Active (${active})`, funded: `Funded (${funded})`, expired: "Expired" };
              const active_ = filter === f;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className="px-3 py-1.5 text-sm font-bold transition-all"
                  style={{
                    background:  active_ ? "var(--primary)" : "transparent",
                    color:       active_ ? "white" : "var(--text-muted)",
                    border:      active_ ? "1.5px solid var(--text)" : "1.5px solid transparent",
                    boxShadow:   active_ ? "2px 2px 0 var(--text)" : "none",
                  }}
                >
                  {labels[f]}
                </button>
              );
            })}
          </div>

          {/* Sort + refresh */}
          <div className="flex items-center gap-2 sm:ml-auto">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="text-sm font-bold py-1.5 px-3 h-9 appearance-none cursor-pointer"
              style={{
                background:  "var(--surface)",
                border:      "1.5px solid var(--border)",
                color:       "var(--text)",
                outline:     "none",
              }}
            >
              <option value="newest">Newest first</option>
              <option value="ending-soon">Ending soon</option>
              <option value="most-funded">Most funded</option>
              <option value="least-funded">Least funded</option>
            </select>
            <Button variant="ghost" size="sm" onClick={() => refetch()} loading={isRefetching}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* ── Grid ── */}
        <div className="pb-20">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-52 animate-pulse" style={{ background: "var(--surface-alt)", border: "1.5px solid var(--border)" }} />
              ))}
            </div>
          ) : error ? (
            <div className="card text-center py-16">
              <p className="text-lg font-bold mb-1" style={{ color: "var(--text)" }}>Failed to load campaigns</p>
              <p className="text-base" style={{ color: "var(--text-muted)" }}>{(error as Error).message}</p>
            </div>
          ) : !campaigns?.length ? (
            <div className="card text-center py-16 max-w-sm mx-auto">
              <EmptyIllustration className="w-40 mx-auto mb-6" />
              <p className="text-lg font-black mb-1" style={{ color: "var(--text)" }}>No campaigns yet</p>
              <p className="text-base mb-6" style={{ color: "var(--text-muted)" }}>Be the first to launch one.</p>
              <Link href="/campaigns/create"><Button><Plus className="w-4 h-4" />Create Campaign</Button></Link>
            </div>
          ) : displayed.length === 0 ? (
            <div className="card text-center py-14">
              <p className="text-lg font-black mb-1" style={{ color: "var(--text)" }}>No campaigns match this filter</p>
              <button onClick={() => setFilter("all")} className="text-base font-bold hover:underline mt-1" style={{ color: "var(--primary)" }}>
                Show all campaigns
              </button>
            </div>
          ) : (
            <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {displayed.map((c: { publicKey: { toBase58(): string }; account: Parameters<typeof CampaignCard>[0]["account"] }) => (
                <CampaignCard key={c.publicKey.toBase58()} publicKey={c.publicKey.toBase58()} account={c.account} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
