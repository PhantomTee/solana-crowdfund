"use client";

import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import BN from "bn.js";
import { Button } from "./ui/button";
import { useClaimRefund, useDonorState } from "@/hooks/use-campaigns";
import { formatUsdc, isDeadlinePassed } from "@/lib/utils";
import { ArrowDownToLine, ShieldOff } from "lucide-react";

interface RefundButtonProps {
  campaignPDA: PublicKey;
  goalMet: boolean;
  deadline: BN;
}

export function RefundButton({ campaignPDA, goalMet, deadline }: RefundButtonProps) {
  const { publicKey } = useWallet();
  const claimRefund = useClaimRefund(campaignPDA);
  const { data: donorState, isLoading } = useDonorState(campaignPDA, publicKey ?? undefined);

  const expired = isDeadlinePassed(deadline.toNumber());
  if (!publicKey || !expired || goalMet || isLoading || !donorState) return null;

  const refundAmount = (donorState as { amount: BN }).amount;
  if (!refundAmount || refundAmount.isZero()) return null;

  const handleRefund = async () => {
    const tid = toast.loading("Claiming refund…");
    try {
      const tx = await claimRefund.mutateAsync();
      toast.success(`Refunded ${formatUsdc(refundAmount)} USDC`, {
        id: tid,
        description: `Tx: ${tx.slice(0, 16)}…`,
        action: { label: "Solscan ↗", onClick: () => window.open(`https://solscan.io/tx/${tx}?cluster=devnet`, "_blank") },
      });
    } catch (err: unknown) {
      toast.error("Refund failed", { id: tid, description: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <div className="card p-6" style={{ borderColor: "rgba(225,29,72,0.35)", background: "rgba(225,29,72,0.04)" }}>
      <div className="flex items-center gap-3 mb-3">
        <div className="h-9 w-9 flex items-center justify-center" style={{ background: "rgba(225,29,72,0.1)", border: "1.5px solid rgba(225,29,72,0.2)" }}>
          <ShieldOff className="w-4 h-4 text-rose-500" />
        </div>
        <h3 className="text-lg font-black text-rose-600">Claim Your Refund</h3>
      </div>
      <p className="text-base mb-5" style={{ color: "var(--text-muted)" }}>
        This campaign expired without reaching its goal. You contributed{" "}
        <span className="font-black" style={{ color: "var(--text)" }}>{formatUsdc(refundAmount)} USDC</span>.
        Claim your full refund trustlessly on-chain.
      </p>
      <Button variant="danger" className="w-full" onClick={handleRefund} loading={claimRefund.isPending}>
        <ArrowDownToLine className="w-4 h-4" />
        Claim {formatUsdc(refundAmount)} USDC
      </Button>
    </div>
  );
}
