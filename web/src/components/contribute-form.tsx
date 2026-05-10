"use client";

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { useContribute } from "@/hooks/use-campaigns";
import { CIRCLE_FAUCET_URL } from "@/lib/constants";
import { ExternalLink, XCircle } from "lucide-react";

interface ContributeFormProps {
  campaignPDA: PublicKey;
  isExpired: boolean;
}

export function ContributeForm({ campaignPDA, isExpired }: ContributeFormProps) {
  const { publicKey } = useWallet();
  const [amount, setAmount] = useState("");
  const contribute = useContribute(campaignPDA);

  const QUICK = [10, 25, 50, 100];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey) { toast.error("Connect your wallet first"); return; }
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) { toast.error("Enter a valid USDC amount"); return; }

    const tid = toast.loading("Sending contribution…");
    try {
      const tx = await contribute.mutateAsync(amountNum);
      toast.success(`Contributed ${amount} USDC!`, {
        id: tid,
        description: `Tx: ${tx.slice(0, 16)}…`,
        action: { label: "Solscan ↗", onClick: () => window.open(`https://solscan.io/tx/${tx}?cluster=devnet`, "_blank") },
      });
      setAmount("");
    } catch (err: unknown) {
      toast.error("Contribution failed", { id: tid, description: err instanceof Error ? err.message : String(err) });
    }
  };

  if (isExpired) {
    return (
      <div className="card p-5 flex items-start gap-3 border-stone-200">
        <XCircle className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-stone-600">Campaign Expired</p>
          <p className="text-xs text-stone-400 mt-0.5">
            Contributions are no longer accepted for this campaign.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <h3 className="font-bold text-[#1c1917] mb-1">Contribute USDC</h3>
      <p className="text-xs text-stone-400 mb-5">
        Need devnet USDC?{" "}
        <a
          href={CIRCLE_FAUCET_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#e05a42] hover:underline inline-flex items-center gap-0.5 font-medium"
        >
          Circle Faucet <ExternalLink className="w-3 h-3" />
        </a>
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Quick amounts */}
        <div className="flex gap-2">
          {QUICK.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setAmount(String(q))}
              className={`flex-1 rounded-xl py-1.5 text-xs font-bold border transition-all duration-150 ${
                amount === String(q)
                  ? "border-[#e05a42] bg-[#fde8e4] text-[#e05a42]"
                  : "border-[#ede8e2] bg-white text-stone-400 hover:border-[#e05a42]/40 hover:text-[#e05a42]"
              }`}
            >
              ${q}
            </button>
          ))}
        </div>

        {/* Input + submit */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="Custom amount…"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input-warm pr-14"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 font-mono pointer-events-none">
              USDC
            </span>
          </div>
          <Button type="submit" loading={contribute.isPending} disabled={!publicKey || !amount}>
            Contribute
          </Button>
        </div>

        {!publicKey && (
          <p className="text-xs text-stone-400 text-center">Connect your wallet to contribute</p>
        )}
      </form>
    </div>
  );
}
