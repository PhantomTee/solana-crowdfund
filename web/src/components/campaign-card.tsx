"use client";

import Link from "next/link";
import BN from "bn.js";
import { formatUsdc, progressPct, formatDeadline, isDeadlinePassed } from "@/lib/utils";
import { Clock, Flag, Users } from "lucide-react";

interface CampaignCardProps {
  publicKey: string;
  account: {
    creator: { toBase58(): string };
    beneficiary: { toBase58(): string };
    goal: BN;
    deadline: BN;
    totalRaised: BN;
    milestoneCount: number;
    milestonesReleased: number;
  };
}

export function CampaignCard({ publicKey, account }: CampaignCardProps) {
  const pct = progressPct(account.totalRaised, account.goal);
  const expired = isDeadlinePassed(account.deadline.toNumber());
  const goalMet = account.totalRaised.gte(account.goal);

  const statusStyle: React.CSSProperties = goalMet
    ? { background: "rgba(22,163,74,0.08)", color: "#16a34a", border: "1.5px solid rgba(22,163,74,0.3)" }
    : expired
    ? { background: "var(--surface-alt)", color: "var(--text-muted)", border: "1.5px solid var(--border)" }
    : { background: "var(--primary-light)", color: "var(--primary)", border: "1.5px solid rgba(224,90,66,0.35)" };

  const statusDot = goalMet ? "bg-green-500" : expired ? "bg-stone-400" : "bg-[var(--primary)]";
  const statusLabel = goalMet ? "Goal Met" : expired ? "Expired" : "Active";
  const progressColor = goalMet ? "#16a34a" : "var(--primary)";

  return (
    <Link
      href={`/campaigns/${publicKey}`}
      className="card card-hover block p-5 group"
    >
      {/* Status + address */}
      <div className="flex items-start justify-between mb-4">
        <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          {publicKey.slice(0, 4)}…{publicKey.slice(-4)}
        </p>
        <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1" style={statusStyle}>
          <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
          {statusLabel}
        </span>
      </div>

      {/* Amount */}
      <div className="mb-3">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-2xl font-black" style={{ color: "var(--text)" }}>
            {formatUsdc(account.totalRaised)}
            <span className="text-sm font-normal ml-1" style={{ color: "var(--text-muted)" }}>USDC</span>
          </span>
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>
            / {formatUsdc(account.goal)}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-2 overflow-hidden" style={{ background: "var(--surface-alt)", border: "1px solid var(--border)" }}>
          <div
            className="h-full transition-all duration-700"
            style={{ width: `${pct}%`, background: progressColor }}
          />
        </div>
        <p className="text-xs mt-1 text-right font-semibold" style={{ color: "var(--text-muted)" }}>
          {pct}%
        </p>
      </div>

      {/* Footer */}
      <div className="pt-3 flex items-center justify-between text-xs" style={{ borderTop: "1.5px solid var(--border)", color: "var(--text-muted)" }}>
        <span className="flex items-center gap-1">
          <Flag className="w-3 h-3" />
          {account.milestonesReleased}/{account.milestoneCount}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {formatDeadline(account.deadline.toNumber())}
        </span>
        <span className="flex items-center gap-1">
          <Users className="w-3 h-3" />
          {account.creator.toBase58().slice(0, 4)}…
        </span>
      </div>
    </Link>
  );
}
