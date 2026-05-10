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
  ) return null;

  const goalMet = totalRaised.gte(goal);
  const allDone = milestonesReleased >= milestoneCount;

  const handleRelease = async () => {
    const tid = toast.loading("Releasing milestone…");
    try {
      const tx = await releaseMilestone.mutateAsync();
      const pct = milestonePercentages[milestonesReleased];
      const amount = goal.muln(pct).divn(100);
      toast.success(`Milestone released: ${formatUsdc(amount)} USDC sent`, {
        id: tid,
        description: `Tx: ${tx.slice(0, 16)}…`,
        action: { label: "Solscan ↗", onClick: () => window.open(`https://solscan.io/tx/${tx}?cluster=devnet`, "_blank") },
      });
    } catch (err: unknown) {
      toast.error("Release failed", { id: tid, description: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <div className="card p-6" style={{ borderColor: "rgba(224,90,66,0.4)" }}>
      <div className="flex items-center gap-3 mb-5">
        <div className="h-9 w-9 flex items-center justify-center" style={{ background: "var(--primary-light)", border: "1.5px solid rgba(224,90,66,0.3)" }}>
          <Flag className="w-4 h-4" style={{ color: "var(--primary)" }} />
        </div>
        <h3 className="text-lg font-black flex-1" style={{ color: "var(--text)" }}>Milestone Releases</h3>
        <span className="text-sm font-bold px-2.5 py-1 border" style={{ background: "var(--surface-alt)", color: "var(--text-muted)", borderColor: "var(--border)" }}>
          {milestonesReleased}/{milestoneCount}
        </span>
      </div>

      <div className="space-y-2 mb-5">
        {milestonePercentages.slice(0, milestoneCount).map((pct, i) => {
          const amount = goal.muln(pct).divn(100);
          const released = i < milestonesReleased;
          const current  = i === milestonesReleased && goalMet;

          const rowStyle: React.CSSProperties = released
            ? { background: "rgba(22,163,74,0.07)", borderColor: "rgba(22,163,74,0.3)", color: "#16a34a" }
            : current
            ? { background: "var(--primary-light)", borderColor: "rgba(224,90,66,0.4)", color: "var(--text)" }
            : { background: "var(--surface-alt)", borderColor: "var(--border)", color: "var(--text-muted)" };

          return (
            <div key={i} className="flex items-center justify-between px-4 py-3 text-base border" style={rowStyle}>
              <div className="flex items-center gap-2.5">
                {released  ? <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: "#16a34a" }} />
                : current  ? <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--primary)" }} />
                           : <Circle       className="w-4 h-4 shrink-0 opacity-30" />}
                <span className="font-bold">Milestone {i + 1}</span>
                <span className="text-sm font-bold px-1.5 py-0.5 border" style={
                  released ? { background: "rgba(22,163,74,0.12)", borderColor: "rgba(22,163,74,0.2)", color: "#16a34a" }
                  : current ? { background: "rgba(224,90,66,0.1)", borderColor: "rgba(224,90,66,0.2)", color: "var(--primary)" }
                  : { background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-muted)" }
                }>
                  {pct}%
                </span>
              </div>
              <span className="font-mono font-bold text-sm">{formatUsdc(amount)} USDC</span>
            </div>
          );
        })}
      </div>

      {!goalMet && (
        <div className="flex items-start gap-2 px-4 py-3 text-sm border" style={{ background: "rgba(202,138,4,0.08)", borderColor: "rgba(202,138,4,0.3)", color: "var(--warning)" }}>
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          Goal must be fully funded before milestones can be released.
        </div>
      )}

      {!allDone && goalMet && (
        <Button onClick={handleRelease} loading={releaseMilestone.isPending} className="w-full">
          Release Milestone {milestonesReleased + 1}
          <span className="ml-1 opacity-70 font-normal text-sm">
            ({milestonePercentages[milestonesReleased]}% = {formatUsdc(goal.muln(milestonePercentages[milestonesReleased]).divn(100))} USDC)
          </span>
        </Button>
      )}

      {allDone && (
        <div className="flex items-center justify-center gap-2 px-4 py-3 text-base font-bold border" style={{ background: "rgba(22,163,74,0.07)", borderColor: "rgba(22,163,74,0.3)", color: "#16a34a" }}>
          <CheckCircle2 className="w-4 h-4" />
          All milestones released!
        </div>
      )}
    </div>
  );
}
