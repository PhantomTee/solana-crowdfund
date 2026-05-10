"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Play, Pause, Volume2, Mic } from "lucide-react";

interface VoicePitchPlayerProps {
  src?:   string;   // data: URL from ElevenLabs
  text?:  string;   // fallback: raw text for browser speechSynthesis
  label?: string;
}

export function VoicePitchPlayer({
  src,
  text,
  label = "🎙️ Hear from the creator",
}: VoicePitchPlayerProps) {
  // ── Audio mode ──────────────────────────────────────────────
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing,  setPlaying]  = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  // ── Speech synthesis mode ────────────────────────────────────
  const [speaking, setSpeaking] = useState(false);

  const isSynth = !src && !!text;

  useEffect(() => {
    if (isSynth) return;
    const el = audioRef.current;
    if (!el) return;
    const onTime  = () => setProgress(el.currentTime);
    const onMeta  = () => setDuration(el.duration);
    const onEnded = () => { setPlaying(false); setProgress(0); };
    el.addEventListener("timeupdate",     onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("ended",          onEnded);
    return () => {
      el.removeEventListener("timeupdate",     onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("ended",          onEnded);
    };
  }, [src, isSynth]);

  useEffect(() => {
    return () => { if (typeof window !== "undefined") window.speechSynthesis?.cancel(); };
  }, []);

  const toggleAudio = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); }
    else         { el.play();  setPlaying(true);  }
  };

  const toggleSynth = useCallback(() => {
    if (!text || typeof window === "undefined") return;
    const synth = window.speechSynthesis;
    if (speaking) { synth.cancel(); setSpeaking(false); return; }
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate  = 0.95;
    utt.pitch = 1.0;
    utt.onend   = () => setSpeaking(false);
    utt.onerror = () => setSpeaking(false);
    synth.speak(utt);
    setSpeaking(true);
  }, [text, speaking]);

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = audioRef.current;
    if (!el || !duration) return;
    el.currentTime = parseFloat(e.target.value);
    setProgress(el.currentTime);
  };

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  const isActive = isSynth ? speaking : playing;

  return (
    <div className="card p-4" style={{ borderColor: "rgba(224,90,66,0.4)" }}>
      {!isSynth && <audio ref={audioRef} src={src} preload="metadata" />}

      <div className="flex items-center gap-3 mb-3">
        <div className="h-8 w-8 flex items-center justify-center shrink-0"
          style={{ background: "var(--primary-light)", border: "1.5px solid rgba(224,90,66,0.3)" }}>
          {isSynth
            ? <Mic     className="w-4 h-4" style={{ color: "var(--primary)" }} />
            : <Volume2 className="w-4 h-4" style={{ color: "var(--primary)" }} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-base" style={{ color: "var(--text)" }}>{label}</p>
          {isSynth && (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Browser voice (ElevenLabs unavailable)</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={isSynth ? toggleSynth : toggleAudio}
          className="h-10 w-10 flex items-center justify-center shrink-0 transition-all hover:opacity-80"
          style={{ background: "var(--primary)", border: "2px solid var(--text)" }}
        >
          {isActive
            ? <Pause className="w-4 h-4 text-white" />
            : <Play  className="w-4 h-4 text-white" />}
        </button>

        {isSynth ? (
          <div className="flex-1 flex items-center gap-2 min-w-0">
            {speaking && (
              <div className="flex items-end gap-0.5 h-6">
                {[8, 14, 10, 16, 8].map((h, i) => (
                  <div key={i} className="w-1 animate-pulse"
                    style={{ height: `${h}px`, background: "var(--primary)", animationDelay: `${i * 0.12}s` }} />
                ))}
              </div>
            )}
            <span className="text-sm truncate" style={{ color: "var(--text-muted)" }}>
              {speaking ? "Speaking…" : "Click play to hear the pitch"}
            </span>
          </div>
        ) : (
          <>
            <div className="flex-1">
              <input
                type="range" min={0} max={duration || 0} step={0.1}
                value={progress} onChange={seek}
                className="w-full h-2 appearance-none cursor-pointer"
                style={{
                  accentColor: "var(--primary)",
                  background: `linear-gradient(to right, var(--primary) ${
                    duration ? (progress / duration) * 100 : 0
                  }%, var(--surface-alt) 0%)`,
                }}
              />
            </div>
            <span className="text-sm font-mono shrink-0" style={{ color: "var(--text-muted)" }}>
              {fmt(progress)}{duration ? ` / ${fmt(duration)}` : ""}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
