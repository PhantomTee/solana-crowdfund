"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";
import { WalletButton } from "@/components/wallet-button";
import { useContribute } from "@/hooks/use-campaigns";
import {
  ArrowLeft, Bot, Zap, ExternalLink, Clock,
  CheckCircle2, XCircle, Loader2, AlertCircle,
  TrendingUp, Calendar, Flag,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgentDecision {
  campaignId:  string;
  reasoning:   string;
  goalUsdc:    number;
  raisedUsdc:  number;
  progressPct: number;
  daysLeft:    number;
  milestones:  number;
}

interface RunRecord {
  id:         string;
  timestamp:  number;
  campaignId: string;
  amountUsdc: number;
  txSig:      string;
  reasoning:  string;
  status:     "success" | "error";
  error?:     string;
}

// ── Local history helpers ─────────────────────────────────────────────────────

const HISTORY_KEY = "solfund-agent-runs";

function saveRun(run: RunRecord) {
  try {
    const prev: RunRecord[] = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
    localStorage.setItem(HISTORY_KEY, JSON.stringify([run, ...prev].slice(0, 20)));
  } catch { /* storage full */ }
}

function loadRuns(): RunRecord[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]"); }
  catch { return []; }
}

// ── AgentApprovePanel ─────────────────────────────────────────────────────────
// Separate component so useContribute() is called at the top level with the
// correct PDA — React hooks cannot be called conditionally.

function AgentApprovePanel({
  decision,
  onSuccess,
  onDismiss,
}: {
  decision:  AgentDecision;
  onSuccess: (txSig: string) => void;
  onDismiss: () => void;
}) {
  const contribute = useContribute(new PublicKey(decision.campaignId));

  const handleApprove = async () => {
    try {
      const txSig = await contribute.mutateAsync(1);
      onSuccess(txSig as string);
    } catch (err) {
      toast.error("Donation failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return (
    <div className="card p-5" style={{ borderColor: "rgba(224,90,66,0.35)" }}>

      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Bot className="w-5 h-5" style={{ color: "var(--primary)" }} />
        <span className="font-black text-base" style={{ color: "var(--text)" }}>Agent Decision</span>
        <span className="ml-auto text-xs font-bold px-2 py-0.5"
          style={{ background: "var(--primary-light)", color: "var(--primary)", border: "1.5px solid rgba(224,90,66,0.3)" }}>
          PENDING APPROVAL
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { icon: <TrendingUp className="w-3.5 h-3.5" />, label: "Funded",     value: `${decision.progressPct}%` },
          { icon: <Calendar   className="w-3.5 h-3.5" />, label: "Days Left",  value: `${decision.daysLeft}d`    },
          { icon: <Flag       className="w-3.5 h-3.5" />, label: "Milestones", value: `${decision.milestones}`   },
        ].map(({ icon, label, value }) => (
          <div key={label} className="p-3 text-center"
            style={{ background: "var(--surface-alt)", border: "1.5px solid var(--border)" }}>
            <div className="flex items-center justify-center gap-1 text-xs font-bold uppercase tracking-wide mb-1"
              style={{ color: "var(--text-muted)" }}>
              {icon}{label}
            </div>
            <p className="text-xl font-black" style={{ color: "var(--text)" }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Reasoning */}
      <div className="p-3 mb-4" style={{ background: "var(--surface-alt)", border: "1.5px solid var(--border)" }}>
        <p className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>
          Why this campaign?
        </p>
        <p className="text-base leading-relaxed" style={{ color: "var(--text)" }}>{decision.reasoning}</p>
      </div>

      {/* Amount notice */}
      <div className="flex items-center gap-2 mb-4 p-3"
        style={{ background: "rgba(224,90,66,0.06)", border: "1.5px solid rgba(224,90,66,0.2)" }}>
        <span className="text-base font-black" style={{ color: "var(--primary)" }}>1 USDC</span>
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>
          will be sent from your wallet to this campaign vault
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleApprove}
          disabled={contribute.isPending}
          className="flex-1 flex items-center justify-center gap-2 py-3 font-black text-base border transition-all disabled:opacity-50"
          style={{
            background:  contribute.isPending ? "var(--surface-alt)" : "var(--primary)",
            color:       contribute.isPending ? "var(--text-muted)" : "white",
            borderColor: "var(--text)",
            boxShadow:   contribute.isPending ? "none" : "4px 4px 0 var(--text)",
          }}
        >
          {contribute.isPending
            ? <><Loader2 className="w-4 h-4 animate-spin" />Donating…</>
            : <><Zap className="w-4 h-4" />Approve Donation</>}
        </button>
        <button
          onClick={onDismiss}
          disabled={contribute.isPending}
          className="px-5 py-3 font-bold text-base border transition-all hover:opacity-70 disabled:opacity-30"
          style={{ borderColor: "var(--border)", color: "var(--text-muted)", background: "var(--surface)" }}
        >
          Dismiss
        </button>
      </div>

      <p className="text-xs text-center mt-3" style={{ color: "var(--text-muted)" }}>
        Your wallet will prompt for a signature. You need at least 1 devnet USDC.
      </p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const COOLDOWN = 60;

export default function AgentPage() {
  const { publicKey } = useWallet();

  const [running,     setRunning]     = useState(false);
  const [decision,    setDecision]    = useState<AgentDecision | null>(null);
  const [lastResult,  setLastResult]  = useState<{ txSig: string; campaignId: string; reasoning: string } | null>(null);
  const [cooldownSec, setCooldownSec] = useState(0);
  const [runs,        setRuns]        = useState<RunRecord[]>([]);

  useEffect(() => { setRuns(loadRuns()); }, []);

  useEffect(() => {
    if (cooldownSec <= 0) return;
    const t = setInterval(() => setCooldownSec((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldownSec]);

  const runAgent = useCallback(async () => {
    if (running || cooldownSec > 0 || !publicKey) return;
    setRunning(true);
    setDecision(null);
    setLastResult(null);
    try {
      const res  = await fetch("/api/agent/run", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429) {
          const match = String((data as { error?: string }).error ?? "").match(/(\d+)s/);
          setCooldownSec(match ? parseInt(match[1]) : COOLDOWN);
        }
        toast.error((data as { error?: string }).error ?? "Agent failed");
        return;
      }
      setDecision(data as AgentDecision);
    } catch (err) {
      toast.error("Agent failed", { description: String(err) });
    } finally {
      setRunning(false);
    }
  }, [running, cooldownSec, publicKey]);

  const handleApprovalSuccess = useCallback((txSig: string) => {
    if (!decision) return;
    const run: RunRecord = {
      id:         `run-${Date.now()}`,
      timestamp:  Date.now(),
      campaignId: decision.campaignId,
      amountUsdc: 1,
      txSig,
      reasoning:  decision.reasoning,
      status:     "success",
    };
    saveRun(run);
    setRuns((prev) => [run, ...prev]);
    setLastResult({ txSig, campaignId: decision.campaignId, reasoning: decision.reasoning });
    setDecision(null);
    setCooldownSec(COOLDOWN);
    toast.success("1 USDC donated!", { description: "Your donation is confirmed on-chain." });
  }, [decision]);

  const fmt = (ts: number) =>
    new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>

      {/* Navbar */}
      <nav className="sticky top-0 z-30" style={{ background: "var(--surface)", borderBottom: "2px solid var(--border)" }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/campaigns" className="inline-flex items-center gap-2 text-base font-bold hover:opacity-80 transition-opacity"
            style={{ color: "var(--text-muted)" }}>
            <ArrowLeft className="w-4 h-4" />All Campaigns
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <WalletButton />
          </div>
        </div>
      </nav>

      <div className="page-enter stagger max-w-2xl mx-auto px-4 sm:px-6 py-12 pb-20 space-y-5">

        {/* Header */}
        <div>
          <div className="inline-flex items-center gap-2 mb-3 px-3 py-1.5 text-sm font-bold"
            style={{ background: "var(--primary-light)", border: "1.5px solid rgba(224,90,66,0.35)", color: "var(--primary)" }}>
            <Bot className="w-4 h-4" />Powered by Virtuals GAME
          </div>
          <h1 className="text-4xl font-black tracking-tight mb-2" style={{ color: "var(--text)" }}>AI Donation Agent</h1>
          <p className="text-base leading-relaxed" style={{ color: "var(--text-muted)" }}>
            The agent fetches all active campaigns, uses Virtuals GAME to reason over them, then recommends the best one.
            You approve the donation from your own wallet — nothing moves without your signature.
          </p>
        </div>

        {/* Wallet required */}
        {!publicKey && (
          <div className="card p-4 flex items-start gap-3"
            style={{ borderColor: "rgba(202,138,4,0.4)", background: "rgba(202,138,4,0.06)" }}>
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" />
            <div>
              <p className="font-bold text-base text-amber-700 dark:text-amber-400">Connect your wallet to use the agent</p>
              <p className="text-sm mt-0.5 text-amber-600 dark:text-amber-500">
                Your wallet signs the 1 USDC donation. Make sure you have devnet USDC from{" "}
                <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer"
                  className="font-bold underline">faucet.circle.com</a>.
              </p>
            </div>
          </div>
        )}

        {/* Run card */}
        <div className="card p-5" style={{ borderColor: "rgba(224,90,66,0.3)" }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 flex items-center justify-center"
              style={{ background: "var(--primary-light)", border: "1.5px solid rgba(224,90,66,0.3)" }}>
              <Zap className="w-5 h-5" style={{ color: "var(--primary)" }} />
            </div>
            <div>
              <p className="font-black text-base" style={{ color: "var(--text)" }}>Run Agent</p>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Virtuals AI analyses all campaigns and selects the best one for your 1 USDC
              </p>
            </div>
          </div>

          <button
            onClick={runAgent}
            disabled={running || cooldownSec > 0 || !publicKey}
            className="w-full flex items-center justify-center gap-2 py-3 text-base font-black border transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background:  running || cooldownSec > 0 || !publicKey ? "var(--surface-alt)" : "var(--primary)",
              color:       running || cooldownSec > 0 || !publicKey ? "var(--text-muted)" : "white",
              borderColor: "var(--text)",
              boxShadow:   running || cooldownSec > 0 || !publicKey ? "none" : "4px 4px 0 var(--text)",
            }}
          >
            {running ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Agent thinking…</>
            ) : cooldownSec > 0 ? (
              <><Clock className="w-4 h-4" />Cooldown: {cooldownSec}s</>
            ) : !publicKey ? (
              <><Bot className="w-4 h-4" />Connect Wallet to Run</>
            ) : (
              <><Bot className="w-4 h-4" />Run Agent</>
            )}
          </button>
        </div>

        {/* Pending decision — approve or dismiss */}
        {decision && (
          <AgentApprovePanel
            decision={decision}
            onSuccess={handleApprovalSuccess}
            onDismiss={() => setDecision(null)}
          />
        )}

        {/* Last confirmed donation */}
        {lastResult && (
          <div className="card p-4"
            style={{ borderColor: "rgba(22,163,74,0.3)", background: "rgba(22,163,74,0.04)" }}>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span className="font-black text-sm text-green-700 dark:text-green-400">1 USDC donated on-chain</span>
            </div>
            <p className="text-sm mb-3" style={{ color: "var(--text-muted)" }}>{lastResult.reasoning}</p>
            <div className="flex items-center gap-4 flex-wrap">
              <Link href={`/campaigns/${lastResult.campaignId}`}
                className="text-sm font-bold hover:underline" style={{ color: "var(--primary)" }}>
                View campaign →
              </Link>
              <a href={`https://solscan.io/tx/${lastResult.txSig}?cluster=devnet`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-bold hover:underline"
                style={{ color: "var(--text-muted)" }}>
                <ExternalLink className="w-3 h-3" />Solscan
              </a>
            </div>
          </div>
        )}

        {/* Run history */}
        {runs.length > 0 && (
          <div className="card p-5">
            <h2 className="font-black text-base mb-4" style={{ color: "var(--text)" }}>
              Your Donation History
              <span className="font-normal text-sm ml-2" style={{ color: "var(--text-muted)" }}>({runs.length})</span>
            </h2>
            <div className="space-y-2">
              {runs.map((run) => (
                <div key={run.id} className="p-3 flex items-start justify-between gap-3"
                  style={{ background: "var(--surface-alt)", border: "1.5px solid var(--border)" }}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {run.status === "success"
                        ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-green-600" />
                        : <XCircle      className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--primary)" }} />}
                      <span className="text-sm font-black" style={{ color: "var(--text)" }}>
                        {run.status === "success" ? `+${run.amountUsdc} USDC` : "Failed"}
                      </span>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{fmt(run.timestamp)}</span>
                    </div>
                    <p className="text-xs leading-snug line-clamp-2" style={{ color: "var(--text-muted)" }}>
                      {run.status === "success" ? run.reasoning : run.error}
                    </p>
                  </div>
                  {run.status === "success" && run.txSig && (
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <a href={`https://solscan.io/tx/${run.txSig}?cluster=devnet`}
                        target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-bold hover:underline"
                        style={{ color: "var(--primary)" }}>
                        <ExternalLink className="w-3 h-3" />Solscan
                      </a>
                      <Link href={`/campaigns/${run.campaignId}`}
                        className="text-xs hover:underline" style={{ color: "var(--text-muted)" }}>
                        Campaign →
                      </Link>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
