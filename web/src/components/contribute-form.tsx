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
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) { toast.error("Enter a valid USDC amount"); return; }

    const tid = toast.loading("Sending contribution…");
    try {
      const tx = await contribute.mutateAsync(num);
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
      <div className="card p-5 flex items-start gap-3" style={{ borderColor: "rgba(156,163,175,0.5)" }}>
        <XCircle className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "var(--text-muted)" }} />
        <div>
          <p className="font-bold" style={{ color: "var(--text-muted)" }}>Campaign Expired</p>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            Contributions are no longer accepted.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <h3 className="text-lg font-black mb-1" style={{ color: "var(--text)" }}>Contribute USDC</h3>
      <p className="text-sm mb-5" style={{ color: "var(--text-muted)" }}>
        Need devnet USDC?{" "}
        <a href={CIRCLE_FAUCET_URL} target="_blank" rel="noopener noreferrer"
          className="font-bold inline-flex items-center gap-1 hover:underline" style={{ color: "var(--primary)" }}>
          Circle Faucet <ExternalLink className="w-3 h-3" />
        </a>
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2">
          {QUICK.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setAmount(String(q))}
              className="flex-1 py-2 text-sm font-bold border transition-all duration-150"
              style={
                amount === String(q)
                  ? { background: "var(--primary-light)", color: "var(--primary)", borderColor: "var(--primary)" }
                  : { background: "var(--surface)", color: "var(--text-muted)", borderColor: "var(--border)" }
              }
            >
              ${q}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <div className="flex-1 relative">
            <input
              type="number" min="0.01" step="0.01"
              placeholder="Custom amount…"
              value={amount} onChange={(e) => setAmount(e.target.value)}
              className="input-warm pr-16"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-mono pointer-events-none" style={{ color: "var(--text-muted)" }}>
              USDC
            </span>
          </div>
          <Button type="submit" loading={contribute.isPending} disabled={!publicKey || !amount}>
            Contribute
          </Button>
        </div>

        {!publicKey && (
          <p className="text-sm text-center" style={{ color: "var(--text-muted)" }}>
            Connect your wallet to contribute
          </p>
        )}
      </form>
    </div>
  );
}
