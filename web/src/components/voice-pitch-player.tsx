"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2 } from "lucide-react";

interface VoicePitchPlayerProps {
  src: string;           // data: URL or blob URL
  label?: string;
}

export function VoicePitchPlayer({
  src,
  label = "🎙️ Hear from the creator",
}: VoicePitchPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying]     = useState(false);
  const [progress, setProgress]   = useState(0);
  const [duration, setDuration]   = useState(0);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onTime  = () => setProgress(el.currentTime);
    const onMeta  = () => setDuration(el.duration);
    const onEnded = () => { setPlaying(false); setProgress(0); };

    el.addEventListener("timeupdate",      onTime);
    el.addEventListener("loadedmetadata",  onMeta);
    el.addEventListener("ended",           onEnded);
    return () => {
      el.removeEventListener("timeupdate",     onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("ended",          onEnded);
    };
  }, [src]);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); }
    else         { el.play(); setPlaying(true); }
  };

  const seek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = audioRef.current;
    if (!el || !duration) return;
    el.currentTime = parseFloat(e.target.value);
    setProgress(el.currentTime);
  };

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <div
      className="card p-4"
      style={{ borderColor: "rgba(224,90,66,0.4)" }}
    >
      <audio ref={audioRef} src={src} preload="metadata" />

      <div className="flex items-center gap-3 mb-3">
        <div
          className="h-8 w-8 flex items-center justify-center shrink-0"
          style={{ background: "var(--primary-light)", border: "1.5px solid rgba(224,90,66,0.3)" }}
        >
          <Volume2 className="w-4 h-4" style={{ color: "var(--primary)" }} />
        </div>
        <span className="font-black text-base" style={{ color: "var(--text)" }}>
          {label}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          className="h-10 w-10 flex items-center justify-center shrink-0 transition-all hover:opacity-80"
          style={{ background: "var(--primary)", border: "2px solid var(--text)" }}
        >
          {playing
            ? <Pause  className="w-4 h-4 text-white" />
            : <Play   className="w-4 h-4 text-white" />}
        </button>

        <div className="flex-1">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={progress}
            onChange={seek}
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
      </div>
    </div>
  );
}
