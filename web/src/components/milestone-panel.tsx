"use client";

import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import BN from "bn.js";
import { Button } from "./ui/button";
import { useReleaseMilestone } from "@/hooks/use-campaigns";
import { formatUsdc } from "@/lib/utils";
import { CheckCircle2, Circle, ChevronRight, Flag, AlertCircle } from "lucide-react";

interface MilestonePanelProps {
  campaignPDA: PublicKey;
  creator: PublicKey;
  beneficiary: PublicKey;
  goal: BN;
  totalRaised: BN;
  milestoneCount: number;
  milestonesReleased: number;
  milestonePercentages: number[];
}

export function MilestonePanel({
  campaignPDA, creator, beneficiary, goal, totalRaised,
  milestoneCount, milestonesReleased, milestonePercentages,
}: MilestonePanelProps) {
  const { publicKey } = useWallet();
  const releaseMilestone = useReleaseMilestone(campaignPDA, beneficiary);

  if (
    !publicKey ||
    (publicKey.toBase58() !== creator.toBase58() &&
      publicKey.toBase58() !== beneficiary.toBase58())
  ) {
    return null;
  }

  const goalMet = totalRaised.gte(goal);
  const allDone = milestonesReleased >= milestoneCount;

  const handleRelease = async () => {
    const tid = toast.loading("Releasing milestone…");
    try {
      const tx = await releaseMilestone.mutateAsync();
      const pct = milestonePercentages[milestonesReleased];
      const amount = goal.muln(pct).divn(100);
      toast.success(`Milestone released — ${formatUsdc(amount)} USDC sent`, {
        id: tid,
        description: `Tx: ${tx.slice(0, 16)}…`,
        action: { label: "Solscan ↗", onClick: () => window.open(`https://solscan.io/tx/${tx}?cluster=devnet`, "_blank") },
      });
    } catch (err: unknown) {
      toast.error("Release failed", { id: tid, description: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <div className="card p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <div className="h-8 w-8 rounded-xl bg-[#fde8e4] flex items-center justify-center">
          <Flag className="w-4 h-4 text-[#e05a42]" />
        </div>
        <h3 className="font-bold text-[#1c1917] flex-1">Milestone Releases</h3>
        <span className="text-xs text-stone-400 bg-stone-100 px-2.5 py-1 rounded-full">
          {milestonesReleased}/{milestoneCount} done
        </span>
      </div>

      {/* Milestone list */}
      <div className="space-y-2 mb-5">
        {milestonePercentages.slice(0, milestoneCount).map((pct, i) => {
          const amount = goal.muln(pct).divn(100);
          const released = i < milestonesReleased;
          const current = i === milestonesReleased && goalMet;

          return (
            <div
              key={i}
              className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm border transition-all ${
                released
                  ? "border-green-200 bg-green-50 text-green-700"
                  : current
                  ? "border-[#e05a42]/30 bg-[#fde8e4] text-[#1c1917]"
                  : "border-[#ede8e2] bg-stone-50 text-stone-400"
              }`}
            >
              <div className="flex items-center gap-2.5">
                {released ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                ) : current ? (
                  <ChevronRight className="w-4 h-4 text-[#e05a42] shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 shrink-0 opacity-30" />
                )}
                <span className="font-semibold">Milestone {i + 1}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${
                  released ? "bg-green-100 text-green-600" :
                  current ? "bg-[#e05a42]/15 text-[#e05a42]" :
                  "bg-stone-200 text-stone-400"
                }`}>
                  {pct}%
                </span>
              </div>
              <span className="font-mono text-xs font-semibold">
                {formatUsdc(amount)} USDC
              </span>
            </div>
          );
        })}
      </div>

      {!goalMet && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-2 text-xs text-amber-700">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          Goal must be fully funded before milestones can be released.
        </div>
      )}

      {!allDone && goalMet && (
        <Button onClick={handleRelease} loading={releaseMilestone.isPending} className="w-full">
          Release Milestone {milestonesReleased + 1}
          <span className="ml-1 opacity-75 font-normal">
            ({milestonePercentages[milestonesReleased]}% = {formatUsdc(goal.muln(milestonePercentages[milestonesReleased]).divn(100))} USDC)
          </span>
        </Button>
      )}

      {allDone && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 font-semibold text-center flex items-center justify-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          All milestones have been released!
        </div>
      )}
    </div>
  );
}
