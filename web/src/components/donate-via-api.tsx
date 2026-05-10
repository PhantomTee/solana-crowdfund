"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Copy, Check, Terminal, ExternalLink } from "lucide-react";

interface PaymentRecord {
  txSig: string;
  amount: number;
  amountUsdc: number;
  timestamp: number;
  source?: "x402" | "agent";
}

interface DonateViaApiProps {
  campaignId: string;
  vaultAddress: string;
}

export function DonateViaApi({ campaignId, vaultAddress }: DonateViaApiProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const endpoint = `${baseUrl}/api/campaigns/${campaignId}/donate`;

  const curlGet = `curl -i "${endpoint}"`;
  const curlPost = `# 1. Send ≥1 USDC to vault: ${vaultAddress}\n#    (use your wallet, spl-token CLI, or any Solana SDK)\n\n# 2. Submit the tx signature:\ncurl -X POST "${endpoint}" \\\n  -H "X-Payment: <YOUR_TX_SIGNATURE>"`;

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  useEffect(() => {
    if (!open) return;
    fetch(`/api/campaigns/${campaignId}/payments`)
      .then((r) => r.json())
      .then((data) => setPayments(data.payments ?? []))
      .catch(() => {});
  }, [open, campaignId]);

  return (
    <div className="card" style={{ borderColor: "rgba(224,90,66,0.3)" }}>
      {/* Header toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between p-5 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 flex items-center justify-center" style={{ background: "var(--primary-light)", border: "1.5px solid rgba(224,90,66,0.3)" }}>
            <Terminal className="w-4 h-4" style={{ color: "var(--primary)" }} />
          </div>
          <div>
            <p className="font-black text-base" style={{ color: "var(--text)" }}>Donate via API</p>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>x402 Payment Protocol: contribute programmatically</p>
          </div>
        </div>
        {open
          ? <ChevronUp className="w-5 h-5 shrink-0" style={{ color: "var(--text-muted)" }} />
          : <ChevronDown className="w-5 h-5 shrink-0" style={{ color: "var(--text-muted)" }} />}
      </button>

      {open && (
        <div className="px-5 pb-6 space-y-5" style={{ borderTop: "1.5px solid var(--border)" }}>
          {/* Endpoint info */}
          <div className="mt-5">
            <p className="text-sm font-bold mb-2" style={{ color: "var(--text-muted)" }}>ENDPOINT</p>
            <div className="flex items-center gap-2 p-3 font-mono text-sm" style={{ background: "var(--surface-alt)", border: "1.5px solid var(--border)" }}>
              <span className="font-bold text-xs px-1.5 py-0.5 mr-1" style={{ background: "var(--primary)", color: "white" }}>GET</span>
              <span className="flex-1 truncate" style={{ color: "var(--text)" }}>{endpoint}</span>
              <button onClick={() => copy(endpoint, "url")} className="shrink-0 p-1 transition-colors" style={{ color: "var(--text-muted)" }}>
                {copied === "url" ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
              Returns <span className="font-mono font-bold" style={{ color: "var(--primary)" }}>402</span> with payment headers including the vault address and minimum USDC amount.
            </p>
          </div>

          {/* Vault address */}
          <div>
            <p className="text-sm font-bold mb-2" style={{ color: "var(--text-muted)" }}>VAULT ADDRESS (USDC recipient)</p>
            <div className="flex items-center gap-2 p-3 font-mono text-sm break-all" style={{ background: "var(--surface-alt)", border: "1.5px solid var(--border)", color: "var(--text)" }}>
              <span className="flex-1">{vaultAddress}</span>
              <button onClick={() => copy(vaultAddress, "vault")} className="shrink-0 p-1" style={{ color: "var(--text-muted)" }}>
                {copied === "vault" ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Step 1 curl */}
          <div>
            <p className="text-sm font-bold mb-2" style={{ color: "var(--text-muted)" }}>STEP 1: DISCOVER PAYMENT REQUIREMENTS</p>
            <div className="relative">
              <pre className="p-4 text-sm overflow-x-auto" style={{ background: "#1a1a1a", color: "#f0ebe5", border: "1.5px solid var(--border)" }}>
                <code>{curlGet}</code>
              </pre>
              <button
                onClick={() => copy(curlGet, "get")}
                className="absolute top-2 right-2 p-1.5 border transition-colors"
                style={{ background: "#2a2a2a", borderColor: "#3a3a3a", color: "#9a9288" }}
              >
                {copied === "get" ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Step 2 curl */}
          <div>
            <p className="text-sm font-bold mb-2" style={{ color: "var(--text-muted)" }}>STEP 2: PAY &amp; SUBMIT SIGNATURE</p>
            <div className="relative">
              <pre className="p-4 text-sm overflow-x-auto whitespace-pre-wrap" style={{ background: "#1a1a1a", color: "#f0ebe5", border: "1.5px solid var(--border)" }}>
                <code>{curlPost}</code>
              </pre>
              <button
                onClick={() => copy(curlPost, "post")}
                className="absolute top-2 right-2 p-1.5 border transition-colors"
                style={{ background: "#2a2a2a", borderColor: "#3a3a3a", color: "#9a9288" }}
              >
                {copied === "post" ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Recorded payments */}
          {payments.length > 0 && (
            <div>
              <p className="text-sm font-bold mb-2" style={{ color: "var(--text-muted)" }}>RECORDED PAYMENTS ({payments.length})</p>
              <div className="space-y-2">
                {payments.map((p) => (
                  <div key={p.txSig} className="flex items-center justify-between p-3 text-sm" style={{ background: "var(--surface-alt)", border: "1.5px solid var(--border)" }}>
                    <div>
                      <span className="font-black" style={{ color: "var(--primary)" }}>+{p.amountUsdc.toFixed(2)} USDC</span>
                      {p.source === "agent" && (
                        <span className="ml-2 text-xs font-bold px-1.5 py-0.5" style={{ background: "var(--primary-light)", color: "var(--primary)", border: "1px solid rgba(224,90,66,0.3)" }}>
                          🤖 AI Agent
                        </span>
                      )}
                      <span className="ml-3 font-mono text-xs" style={{ color: "var(--text-muted)" }}>
                        {p.txSig.slice(0, 16)}…
                      </span>
                    </div>
                    <a
                      href={`https://solscan.io/tx/${p.txSig}?cluster=devnet`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs font-bold hover:underline"
                      style={{ color: "var(--primary)" }}
                    >
                      <ExternalLink className="w-3 h-3" />
                      Solscan
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
