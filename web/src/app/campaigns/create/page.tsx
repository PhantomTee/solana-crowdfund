"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import { WalletButton } from "@/components/wallet-button";
import { Button } from "@/components/ui/button";
import { useCreateCampaign } from "@/hooks/use-campaigns";
import { ArrowLeft, Plus, Trash2, AlertCircle } from "lucide-react";

export default function CreateCampaignPage() {
  const router = useRouter();
  const { publicKey } = useWallet();
  const createCampaign = useCreateCampaign();

  const [goal, setGoal] = useState("");
  const [deadline, setDeadline] = useState("");
  const [beneficiaryStr, setBeneficiaryStr] = useState("");
  const [milestones, setMilestones] = useState([50, 30, 20]);

  const milestoneSum = milestones.reduce((a, b) => a + b, 0);
  const sumValid = milestoneSum === 100;

  const addMilestone = () => { if (milestones.length < 10) setMilestones([...milestones, 0]); };
  const removeMilestone = (i: number) => { if (milestones.length > 1) setMilestones(milestones.filter((_, idx) => idx !== i)); };
  const updateMilestone = (i: number, val: number) => { const n = [...milestones]; n[i] = val; setMilestones(n); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey) { toast.error("Connect your wallet first"); return; }

    let beneficiaryKey: PublicKey;
    try {
      beneficiaryKey = new PublicKey(beneficiaryStr || publicKey.toBase58());
    } catch {
      toast.error("Invalid beneficiary address");
      return;
    }

    if (!sumValid) { toast.error(`Milestones must sum to 100 (currently ${milestoneSum})`); return; }

    const deadlineTs = Math.floor(new Date(deadline).getTime() / 1000);
    if (deadlineTs <= Date.now() / 1000) { toast.error("Deadline must be in the future"); return; }

    const tid = toast.loading("Creating campaign…");
    try {
      const result = await createCampaign.mutateAsync({ goalUsdc: parseFloat(goal), deadlineTs, milestones, beneficiary: beneficiaryKey });
      toast.success("Campaign created!", { id: tid, description: `PDA: ${result.campaignPDA.slice(0, 16)}…` });
      router.push(`/campaigns/${result.campaignPDA}`);
    } catch (err: unknown) {
      toast.error("Failed to create campaign", { id: tid, description: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <div className="min-h-screen bg-[#fdfcf8]">
      {/* Navbar */}
      <nav className="sticky top-0 z-30 bg-white/90 backdrop-blur-sm border-b border-[#ede8e2]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/campaigns" className="inline-flex items-center gap-2 text-stone-500 hover:text-[#1c1917] transition-colors text-sm font-medium">
            <ArrowLeft className="w-4 h-4" />
            All Campaigns
          </Link>
          <WalletButton />
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 pb-20">
        {/* Heading */}
        <div className="mb-8">
          <h1 className="text-4xl font-black text-[#1c1917] tracking-tight mb-2">
            New Campaign
          </h1>
          <p className="text-stone-400 text-sm leading-relaxed">
            USDC is held in on-chain escrow and released milestone by milestone.
            Donors get automatic refunds if the goal isn&apos;t met by the deadline.
          </p>
        </div>

        {!publicKey && (
          <div className="card mb-6 p-4 flex items-start gap-3 border-amber-200 bg-amber-50">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700">Connect your wallet to create a campaign.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Goal */}
          <div className="card p-5">
            <label className="label-warm">
              Funding Goal
              <span className="ml-1 normal-case font-normal text-stone-300">— devnet USDC</span>
            </label>
            <div className="relative">
              <input
                type="number" min="1" step="0.01" placeholder="500.00"
                value={goal} onChange={(e) => setGoal(e.target.value)}
                className="input-warm pr-16" required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 font-mono pointer-events-none">
                USDC
              </span>
            </div>
          </div>

          {/* Deadline */}
          <div className="card p-5">
            <label className="label-warm">Campaign Deadline</label>
            <input
              type="datetime-local" value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="input-warm" required
            />
          </div>

          {/* Beneficiary */}
          <div className="card p-5">
            <label className="label-warm">Beneficiary Address</label>
            <p className="text-[11px] text-stone-400 mb-2 -mt-1">
              Leave blank to use your connected wallet
            </p>
            <input
              type="text"
              placeholder={publicKey?.toBase58() ?? "Solana address…"}
              value={beneficiaryStr}
              onChange={(e) => setBeneficiaryStr(e.target.value)}
              className="input-warm font-mono text-xs"
            />
          </div>

          {/* Milestones */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <label className="label-warm mb-0.5">Milestone Percentages</label>
                <p className={`text-xs font-semibold ${sumValid ? "text-green-600" : "text-[#e05a42]"}`}>
                  {sumValid ? "✓ Sums to 100%" : `${milestoneSum}/100 — needs ${100 - milestoneSum > 0 ? `+${100 - milestoneSum}` : 100 - milestoneSum}`}
                </p>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={addMilestone} disabled={milestones.length >= 10}>
                <Plus className="w-3.5 h-3.5" />
                Add
              </Button>
            </div>

            <div className="space-y-2">
              {milestones.map((pct, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-stone-400 w-24 shrink-0 font-mono">
                    Milestone {i + 1}
                  </span>
                  <div className="relative flex-1">
                    <input
                      type="number" min="1" max="100" value={pct}
                      onChange={(e) => updateMilestone(i, parseInt(e.target.value) || 0)}
                      className="input-warm text-center pr-7"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 pointer-events-none">%</span>
                  </div>
                  <button
                    type="button" onClick={() => removeMilestone(i)}
                    disabled={milestones.length <= 1}
                    className="p-1.5 rounded-xl text-stone-300 hover:text-rose-500 hover:bg-rose-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Split preview */}
            <div className="mt-4">
              <p className="text-[11px] text-stone-400 mb-1.5">Split preview</p>
              <div className="h-2.5 rounded-full overflow-hidden flex gap-[2px]">
                {milestones.map((pct, i) => (
                  <div
                    key={i}
                    style={{
                      width: `${pct}%`,
                      background: i === 0 ? "#E05A42" : i === 1 ? "#F08060" : i === 2 ? "#F5A090" : "#FAC4B8",
                    }}
                    className="h-full first:rounded-l-full last:rounded-r-full"
                  />
                ))}
              </div>
            </div>
          </div>

          <Button
            type="submit" size="lg" className="w-full"
            disabled={!publicKey || !sumValid}
            loading={createCampaign.isPending}
          >
            {createCampaign.isPending ? "Creating…" : "Create Campaign"}
          </Button>
        </form>
      </div>
    </div>
  );
}
