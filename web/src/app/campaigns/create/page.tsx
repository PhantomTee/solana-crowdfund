"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import { WalletButton } from "@/components/wallet-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { VoicePitchPlayer } from "@/components/voice-pitch-player";
import { useCreateCampaign } from "@/hooks/use-campaigns";
import { ArrowLeft, Plus, Trash2, AlertCircle, Mic, Loader2 } from "lucide-react";

/** Saves campaign metadata to localStorage */
function saveMeta(pda: string, data: { title: string; description: string; voicePitch?: string; voicePitchText?: string }) {
  try { localStorage.setItem(`solfund-meta-${pda}`, JSON.stringify(data)); }
  catch { /* storage full — silent */ }
}

export default function CreateCampaignPage() {
  const router = useRouter();
  const { publicKey } = useWallet();
  const createCampaign = useCreateCampaign();

  const [goal,          setGoal]          = useState("");
  const [deadline,      setDeadline]      = useState("");
  const [beneficiaryStr,setBeneficiaryStr]= useState("");
  const [milestones,    setMilestones]    = useState([50, 30, 20]);
  const [title,         setTitle]         = useState("");
  const [description,   setDescription]   = useState("");

  const [pitchAudio,    setPitchAudio]    = useState<string | null>(null); // data URL (ElevenLabs)
  const [pitchText,     setPitchText]     = useState<string | null>(null); // fallback: browser synthesis
  const [pitchLoading,  setPitchLoading]  = useState(false);

  const milestoneSum = milestones.reduce((a, b) => a + b, 0);
  const sumValid = milestoneSum === 100;

  const addMilestone    = () => { if (milestones.length < 10) setMilestones([...milestones, 0]); };
  const removeMilestone = (i: number) => { if (milestones.length > 1) setMilestones(milestones.filter((_, idx) => idx !== i)); };
  const updateMilestone = (i: number, val: number) => { const n = [...milestones]; n[i] = val; setMilestones(n); };

  // ── Generate voice pitch ────────────────────────────────────
  const handleGeneratePitch = async () => {
    if (!goal) { toast.error("Enter a funding goal first"); return; }
    const deadlineTs = deadline
      ? Math.floor(new Date(deadline).getTime() / 1000)
      : Math.floor(Date.now() / 1000) + 30 * 86400;

    setPitchLoading(true);
    try {
      const res = await fetch("/api/voice/generate-pitch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:          title.trim()       || undefined,
          description:    description.trim() || undefined,
          goalUsdc:       parseFloat(goal),
          deadlineTs,
          milestoneCount: milestones.length,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");

      const dataUrl = `data:${data.mimeType};base64,${data.audioBase64}`;
      setPitchAudio(dataUrl);
      setPitchText(null);
      toast.success("Voice pitch generated!");
    } catch {
      // ElevenLabs unavailable — fall back to browser speech synthesis
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const fallback = [
          title ? `Welcome to ${title}.` : "",
          description || `We are raising ${goal} USDC${milestones.length > 1 ? ` across ${milestones.length} milestones` : ""}.`,
          "Your support makes a real difference. Please contribute today.",
        ].filter(Boolean).join(" ");
        setPitchText(fallback);
        setPitchAudio(null);
        toast.info("Using browser voice", { description: "ElevenLabs quota reached — your pitch will use browser TTS." });
      } else {
        toast.error("Voice generation unavailable");
      }
    } finally {
      setPitchLoading(false);
    }
  };

  // ── Submit form ─────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey) { toast.error("Connect your wallet first"); return; }

    let beneficiaryKey: PublicKey;
    try { beneficiaryKey = new PublicKey(beneficiaryStr || publicKey.toBase58()); }
    catch { toast.error("Invalid beneficiary address"); return; }

    if (!sumValid) { toast.error(`Milestones must sum to 100 (currently ${milestoneSum})`); return; }

    const deadlineTs = Math.floor(new Date(deadline).getTime() / 1000);
    if (deadlineTs <= Date.now() / 1000) { toast.error("Deadline must be in the future"); return; }

    const tid = toast.loading("Creating campaign…");
    try {
      const result = await createCampaign.mutateAsync({
        goalUsdc: parseFloat(goal),
        deadlineTs,
        milestones,
        beneficiary: beneficiaryKey,
      });

      // Save off-chain metadata (title, description, voice pitch)
      saveMeta(result.campaignPDA, {
        title:       title.trim(),
        description: description.trim(),
        ...(pitchAudio ? { voicePitch: pitchAudio } : {}),
        ...(pitchText && !pitchAudio ? { voicePitchText: pitchText } : {}),
      });

      toast.success("Campaign created!", {
        id: tid,
        description: `PDA: ${result.campaignPDA.slice(0, 16)}…`,
      });
      router.push(`/campaigns/${result.campaignPDA}`);
    } catch (err: unknown) {
      toast.error("Failed to create campaign", {
        id: tid,
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Navbar */}
      <nav className="sticky top-0 z-30" style={{ background: "var(--surface)", borderBottom: "2px solid var(--border)" }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/campaigns" className="inline-flex items-center gap-2 text-base font-bold hover:opacity-80 transition-opacity" style={{ color: "var(--text-muted)" }}>
            <ArrowLeft className="w-4 h-4" />All Campaigns
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <WalletButton />
          </div>
        </div>
      </nav>

      <div className="page-enter max-w-2xl mx-auto px-4 sm:px-6 py-12 pb-20">
        <h1 className="text-4xl font-black tracking-tight mb-2" style={{ color: "var(--text)" }}>New Campaign</h1>
        <p className="text-base leading-relaxed mb-8" style={{ color: "var(--text-muted)" }}>
          USDC is held in on-chain escrow and released milestone by milestone.
          Donors get automatic refunds if the goal isn&apos;t met by the deadline.
        </p>

        {!publicKey && (
          <div className="card mb-6 p-4 flex items-start gap-3" style={{ borderColor: "rgba(202,138,4,0.4)", background: "rgba(202,138,4,0.06)" }}>
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" />
            <p className="text-base text-amber-700 dark:text-amber-400">Connect your wallet to create a campaign.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* ── Title (optional, off-chain) ── */}
          <div className="card p-5">
            <label className="label-warm">
              Campaign Title
              <span className="ml-2 normal-case font-normal" style={{ color: "var(--text-muted)" }}>optional, used for voice pitch</span>
            </label>
            <input
              type="text" maxLength={120} placeholder="e.g. Community Solar Panel Fund"
              value={title} onChange={(e) => setTitle(e.target.value)}
              className="input-warm"
            />
          </div>

          {/* ── Description (optional, off-chain) ── */}
          <div className="card p-5">
            <label className="label-warm">
              Campaign Description
              <span className="ml-2 normal-case font-normal" style={{ color: "var(--text-muted)" }}>optional, used for voice pitch</span>
            </label>
            <textarea
              rows={3} maxLength={500} placeholder="Describe your campaign in a few sentences…"
              value={description} onChange={(e) => setDescription(e.target.value)}
              className="input-warm resize-none"
            />
          </div>

          {/* ── Goal ── */}
          <div className="card p-5">
            <label className="label-warm">
              Funding Goal
              <span className="ml-2 normal-case font-normal" style={{ color: "var(--text-muted)" }}>(devnet USDC)</span>
            </label>
            <div className="relative">
              <input
                type="number" min="1" step="0.01" placeholder="500.00"
                value={goal} onChange={(e) => setGoal(e.target.value)}
                className="input-warm pr-16" required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-mono pointer-events-none" style={{ color: "var(--text-muted)" }}>USDC</span>
            </div>
          </div>

          {/* ── Deadline ── */}
          <div className="card p-5">
            <label className="label-warm">Campaign Deadline</label>
            <input
              type="datetime-local" value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="input-warm" required
            />
          </div>

          {/* ── Beneficiary ── */}
          <div className="card p-5">
            <label className="label-warm">Beneficiary Address</label>
            <p className="text-sm mb-2 -mt-1" style={{ color: "var(--text-muted)" }}>Leave blank to use your connected wallet</p>
            <input
              type="text" placeholder={publicKey?.toBase58() ?? "Solana address…"}
              value={beneficiaryStr} onChange={(e) => setBeneficiaryStr(e.target.value)}
              className="input-warm font-mono text-sm"
            />
          </div>

          {/* ── Milestones ── */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <label className="label-warm mb-0.5">Milestone Percentages</label>
                <p className="text-sm font-bold" style={{ color: sumValid ? "var(--success)" : "var(--primary)" }}>
                  {sumValid ? "✓ Sums to 100%" : `${milestoneSum}/100 (needs ${100 - milestoneSum > 0 ? `+${100 - milestoneSum}` : 100 - milestoneSum})`}
                </p>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={addMilestone} disabled={milestones.length >= 10}>
                <Plus className="w-4 h-4" />Add
              </Button>
            </div>

            <div className="space-y-2">
              {milestones.map((pct, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-sm font-mono w-24 shrink-0" style={{ color: "var(--text-muted)" }}>Milestone {i + 1}</span>
                  <div className="relative flex-1">
                    <input
                      type="number" min="1" max="100" value={pct}
                      onChange={(e) => updateMilestone(i, parseInt(e.target.value) || 0)}
                      className="input-warm text-center pr-7"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none" style={{ color: "var(--text-muted)" }}>%</span>
                  </div>
                  <button
                    type="button" onClick={() => removeMilestone(i)} disabled={milestones.length <= 1}
                    className="h-9 w-9 flex items-center justify-center border transition-all hover:border-rose-400 hover:text-rose-500 disabled:opacity-30 disabled:cursor-not-allowed"
                    style={{ border: "1.5px solid var(--border)", background: "var(--surface)", color: "var(--text-muted)" }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <p className="text-sm font-bold mb-1.5" style={{ color: "var(--text-muted)" }}>Split preview</p>
              <div className="h-3 overflow-hidden flex" style={{ border: "1.5px solid var(--border)" }}>
                {milestones.map((pct, i) => (
                  <div key={i} style={{ width: `${pct}%`, background: i === 0 ? "#E05A42" : i === 1 ? "#F07858" : i === 2 ? "#F5A090" : "#FACDC5" }} className="h-full" />
                ))}
              </div>
            </div>
          </div>

          {/* ── Voice Pitch (opt-in) ── */}
          <div className="card p-5" style={{ borderColor: "rgba(224,90,66,0.3)" }}>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-9 w-9 flex items-center justify-center shrink-0" style={{ background: "var(--primary-light)", border: "1.5px solid rgba(224,90,66,0.3)" }}>
                <Mic className="w-4 h-4" style={{ color: "var(--primary)" }} />
              </div>
              <div>
                <p className="font-black text-base" style={{ color: "var(--text)" }}>Generate Voice Pitch</p>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  AI-generated audio intro shown on your campaign page (optional)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGeneratePitch}
              disabled={pitchLoading || !goal}
              className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 text-base font-bold border transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: "var(--primary-light)",
                borderColor: "rgba(224,90,66,0.4)",
                color: "var(--primary)",
                boxShadow: "3px 3px 0 rgba(224,90,66,0.2)",
              }}
            >
              {pitchLoading
                ? <><Loader2 className="w-4 h-4 animate-spin" />Generating audio…</>
                : <><Mic className="w-4 h-4" />{pitchAudio ? "Regenerate Voice Pitch" : "Generate Voice Pitch"}</>}
            </button>

            {(pitchAudio || pitchText) && (
              <div className="mt-4">
                <VoicePitchPlayer
                  src={pitchAudio ?? undefined}
                  text={pitchText ?? undefined}
                  label="Preview your voice pitch"
                />
                <p className="text-sm mt-2 text-center" style={{ color: "var(--text-muted)" }}>
                  ✓ This pitch will be saved and shown on your campaign page
                </p>
              </div>
            )}
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
