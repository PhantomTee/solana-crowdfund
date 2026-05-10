"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { WalletButton } from "@/components/wallet-button";
import {
  ArrowLeft, Bot, Zap, ExternalLink, RefreshCw, AlertCircle,
  CheckCircle2, XCircle, Loader2, Copy, Check, Clock,
} from "lucide-react";

interface Balance {
  publicKey: string;
  solBalance: number;
  usdcBalance: number;
  faucetUrl: string;
  solFaucetUrl: string;
}

interface AgentRun {
  id: string;
  timestamp: number;
  campaignId: string;
  amountUsdc: number;
  txSig: string;
  reasoning: string;
  status: "success" | "error";
  error?: string;
}

const COOLDOWN = 60; // seconds

export default function AgentPage() {
  const [balance,       setBalance]       = useState<Balance | null>(null);
  const [balLoading,    setBalLoading]    = useState(true);
  const [runs,          setRuns]          = useState<AgentRun[]>([]);
  const [running,       setRunning]       = useState(false);
  const [lastResult,    setLastResult]    = useState<{ ok: boolean; data: unknown } | null>(null);
  const [cooldownSec,   setCooldownSec]   = useState(0);
  const [copied,        setCopied]        = useState(false);

  // ── Load balance ──────────────────────────────────────────────
  const loadBalance = useCallback(async () => {
    setBalLoading(true);
    try {
      const res = await fetch("/api/agent/balance");
      if (res.ok) setBalance(await res.json());
    } finally {
      setBalLoading(false);
    }
  }, []);

  // ── Load run history ─────────────────────────────────────────
  const loadRuns = useCallback(async () => {
    const res = await fetch("/api/agent/runs");
    if (res.ok) {
      const data = await res.json();
      setRuns(data.runs ?? []);
    }
  }, []);

  useEffect(() => {
    loadBalance();
    loadRuns();
  }, [loadBalance, loadRuns]);

  // ── Cooldown countdown ────────────────────────────────────────
  useEffect(() => {
    if (cooldownSec <= 0) return;
    const t = setInterval(() => setCooldownSec((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldownSec]);

  // ── Copy wallet address ───────────────────────────────────────
  const copyAddress = async () => {
    if (!balance?.publicKey) return;
    await navigator.clipboard.writeText(balance.publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Run agent ─────────────────────────────────────────────────
  const runAgent = async () => {
    if (running || cooldownSec > 0) return;
    setRunning(true);
    setLastResult(null);
    try {
      const res = await fetch("/api/agent/run", { method: "POST" });
      const data = await res.json();
      setLastResult({ ok: res.ok, data });
      if (res.ok) {
        setCooldownSec(COOLDOWN);
        loadBalance();
        loadRuns();
      } else if (res.status === 429) {
        // Server says cooldown active — parse remaining
        const match = String((data as { error?: string }).error ?? "").match(/(\d+)s/);
        setCooldownSec(match ? parseInt(match[1]) : COOLDOWN);
      }
    } catch (err) {
      setLastResult({ ok: false, data: { error: String(err) } });
    } finally {
      setRunning(false);
    }
  };

  const fmt = (ts: number) =>
    new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Navbar */}
      <nav className="sticky top-0 z-30" style={{ background: "var(--surface)", borderBottom: "2px solid var(--border)" }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/campaigns" className="inline-flex items-center gap-2 text-base font-bold hover:opacity-80 transition-opacity" style={{ color: "var(--text-muted)" }}>
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
          <div className="inline-flex items-center gap-2 mb-3 px-3 py-1.5 text-sm font-bold" style={{ background: "var(--primary-light)", border: "1.5px solid rgba(224,90,66,0.35)", color: "var(--primary)" }}>
            <Bot className="w-4 h-4" />
            Powered by Virtuals GAME
          </div>
          <h1 className="text-4xl font-black tracking-tight mb-2" style={{ color: "var(--text)" }}>AI Donation Agent</h1>
          <p className="text-base leading-relaxed" style={{ color: "var(--text-muted)" }}>
            An autonomous agent that analyses active campaigns and donates 1 USDC to the most deserving one. On-chain, no human required.
          </p>
        </div>

        {/* Wallet card */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-black text-base" style={{ color: "var(--text)" }}>Agent Wallet</h2>
            <button
              onClick={loadBalance}
              disabled={balLoading}
              className="p-1.5 border transition-all hover:opacity-70 disabled:opacity-40"
              style={{ border: "1.5px solid var(--border)", background: "var(--surface)" }}
              aria-label="Refresh balance"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${balLoading ? "animate-spin" : ""}`} style={{ color: "var(--text-muted)" }} />
            </button>
          </div>

          {balance ? (
            <div className="space-y-3">
              {/* Address */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>Solana Address (Devnet)</p>
                <div className="flex items-center gap-2 p-3" style={{ background: "var(--surface-alt)", border: "1.5px solid var(--border)" }}>
                  <span className="font-mono text-sm flex-1 truncate" style={{ color: "var(--text)" }}>{balance.publicKey}</span>
                  <button onClick={copyAddress} className="shrink-0 p-1 transition-colors" style={{ color: "var(--text-muted)" }}>
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Balances */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3" style={{ background: "var(--surface-alt)", border: "1.5px solid var(--border)" }}>
                  <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>USDC Balance</p>
                  <p className="text-2xl font-black" style={{ color: balance.usdcBalance >= 1 ? "var(--success)" : "var(--primary)" }}>
                    {balance.usdcBalance.toFixed(2)}
                    <span className="text-sm font-normal ml-1" style={{ color: "var(--text-muted)" }}>USDC</span>
                  </p>
                </div>
                <div className="p-3" style={{ background: "var(--surface-alt)", border: "1.5px solid var(--border)" }}>
                  <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>SOL Balance</p>
                  <p className="text-2xl font-black" style={{ color: "var(--text)" }}>
                    {balance.solBalance.toFixed(4)}
                    <span className="text-sm font-normal ml-1" style={{ color: "var(--text-muted)" }}>SOL</span>
                  </p>
                </div>
              </div>

              {/* Funding hint */}
              {(balance.usdcBalance < 1 || balance.solBalance < 0.001) && (
                <div className="p-3 flex items-start gap-2" style={{ background: "rgba(202,138,4,0.06)", border: "1.5px solid rgba(202,138,4,0.3)" }}>
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                  <div className="text-sm" style={{ color: "var(--text-muted)" }}>
                    {balance.usdcBalance < 1 && (
                      <p>Agent needs ≥1 USDC to donate. Fund it at{" "}
                        <a href={balance.faucetUrl} target="_blank" rel="noopener noreferrer" className="font-bold hover:underline" style={{ color: "var(--primary)" }}>
                          faucet.circle.com
                        </a>
                        {" "}(wallet: <span className="font-mono">{balance.publicKey.slice(0, 8)}…</span>)
                      </p>
                    )}
                    {balance.solBalance < 0.001 && (
                      <p className={balance.usdcBalance < 1 ? "mt-1" : ""}>Agent needs SOL for gas. Fund it at{" "}
                        <a href={balance.solFaucetUrl} target="_blank" rel="noopener noreferrer" className="font-bold hover:underline" style={{ color: "var(--primary)" }}>
                          faucet.solana.com
                        </a>
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : balLoading ? (
            <div className="h-24 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--text-muted)" }} />
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Failed to load balance.</p>
          )}
        </div>

        {/* Run card */}
        <div className="card p-5" style={{ borderColor: "rgba(224,90,66,0.3)" }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 flex items-center justify-center" style={{ background: "var(--primary-light)", border: "1.5px solid rgba(224,90,66,0.3)" }}>
              <Zap className="w-5 h-5" style={{ color: "var(--primary)" }} />
            </div>
            <div>
              <p className="font-black text-base" style={{ color: "var(--text)" }}>Run Agent</p>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Virtuals AI reasons over all active campaigns and donates 1 USDC on-chain
              </p>
            </div>
          </div>

          <button
            onClick={runAgent}
            disabled={running || cooldownSec > 0}
            className="w-full flex items-center justify-center gap-2 py-3 text-base font-black border transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background:   running || cooldownSec > 0 ? "var(--surface-alt)" : "var(--primary)",
              color:        running || cooldownSec > 0 ? "var(--text-muted)" : "white",
              borderColor:  "var(--text)",
              boxShadow:    running || cooldownSec > 0 ? "none" : "4px 4px 0 var(--text)",
            }}
          >
            {running ? (
              <><Loader2 className="w-4 h-4 animate-spin" />Agent thinking…</>
            ) : cooldownSec > 0 ? (
              <><Clock className="w-4 h-4" />Cooldown: {cooldownSec}s</>
            ) : (
              <><Bot className="w-4 h-4" />Run Agent Now</>
            )}
          </button>

          {/* Last result */}
          {lastResult && (
            <div className="mt-4 p-4" style={{
              background: lastResult.ok ? "rgba(22,163,74,0.06)" : "rgba(224,90,66,0.06)",
              border: `1.5px solid ${lastResult.ok ? "rgba(22,163,74,0.3)" : "rgba(224,90,66,0.3)"}`,
            }}>
              {lastResult.ok ? (
                (() => {
                  const d = lastResult.data as { campaignId: string; amountUsdc: number; txSig: string; reasoning: string; solscan: string };
                  return (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span className="font-black text-sm text-green-700 dark:text-green-400">Donated {d.amountUsdc} USDC successfully</span>
                      </div>
                      <p className="text-sm mb-2" style={{ color: "var(--text-muted)" }}>{d.reasoning}</p>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <Link href={`/campaigns/${d.campaignId}`} className="text-xs font-bold hover:underline" style={{ color: "var(--primary)" }}>
                          View campaign →
                        </Link>
                        <a href={d.solscan} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold hover:underline" style={{ color: "var(--text-muted)" }}>
                          <ExternalLink className="w-3 h-3" />Solscan
                        </a>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--primary)" }} />
                  <p className="text-sm" style={{ color: "var(--text)" }}>
                    {String((lastResult.data as { error?: string }).error ?? "Unknown error")}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Run history */}
        {runs.length > 0 && (
          <div className="card p-5">
            <h2 className="font-black text-base mb-4" style={{ color: "var(--text)" }}>
              Run History <span className="font-normal text-sm ml-1" style={{ color: "var(--text-muted)" }}>({runs.length})</span>
            </h2>
            <div className="space-y-2">
              {runs.map((run) => (
                <div
                  key={run.id}
                  className="p-3 flex items-start justify-between gap-3"
                  style={{ background: "var(--surface-alt)", border: "1.5px solid var(--border)" }}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {run.status === "success"
                        ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-green-600" />
                        : <XCircle className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--primary)" }} />}
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
                      <a
                        href={`https://solscan.io/tx/${run.txSig}?cluster=devnet`}
                        target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-bold hover:underline"
                        style={{ color: "var(--primary)" }}
                      >
                        <ExternalLink className="w-3 h-3" />Solscan
                      </a>
                      <Link href={`/campaigns/${run.campaignId}`} className="text-xs hover:underline" style={{ color: "var(--text-muted)" }}>
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
