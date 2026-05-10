"use client";

import Link from "next/link";
import BN from "bn.js";
import { formatUsdc, progressPct, formatDeadline, isDeadlinePassed } from "@/lib/utils";
import { Clock, Users, Flag } from "lucide-react";

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

  const statusBg = goalMet
    ? "bg-green-50 text-green-700 border-green-200"
    : expired
    ? "bg-stone-100 text-stone-500 border-stone-200"
    : "bg-[#fde8e4] text-[#e05a42] border-[#f5c4bb]";

  const statusDot = goalMet ? "bg-green-500" : expired ? "bg-stone-400" : "bg-[#e05a42]";
  const statusLabel = goalMet ? "Goal Met" : expired ? "Expired" : "Active";

  const progressColor = goalMet ? "bg-green-500" : "bg-[#e05a42]";

  return (
    <Link
      href={`/campaigns/${publicKey}`}
      className="card card-hover block p-5 group"
    >
      {/* Status + address */}
      <div className="flex items-start justify-between mb-4">
        <p className="text-[11px] text-stone-400 font-mono">
          {publicKey.slice(0, 4)}…{publicKey.slice(-4)}
        </p>
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${statusBg}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
          {statusLabel}
        </span>
      </div>

      {/* Raised amount */}
      <div className="mb-3">
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-xl font-black text-[#1c1917]">
            {formatUsdc(account.totalRaised)}
            <span className="text-xs text-stone-400 font-normal ml-1">USDC</span>
          </span>
          <span className="text-xs text-stone-400">
            / {formatUsdc(account.goal)}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${progressColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-[11px] text-stone-400">
          <span>{pct}% funded</span>
        </div>
      </div>

      {/* Footer */}
      <div className="pt-3 border-t border-[#ede8e2] flex items-center justify-between text-[11px] text-stone-400">
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
