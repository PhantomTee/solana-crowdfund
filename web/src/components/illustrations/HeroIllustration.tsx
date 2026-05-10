export function HeroIllustration({ className }: { className?: string }) {
  const skin = "#D4A574";
  const outline = "#1C1917";
  const sw = 2.5;

  return (
    <svg
      viewBox="0 0 340 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Decorative circles */}
      <circle cx="28" cy="130" r="18" fill="#FDE8E4" stroke={outline} strokeWidth={sw} />
      <circle cx="312" cy="90" r="12" fill="#FDE8E4" stroke={outline} strokeWidth={sw} />
      <circle cx="170" cy="195" r="8" fill="#E05A42" opacity="0.3" />

      {/* Star sparkle at high-five point */}
      <path
        d="M170 32 L172.5 24 L175 32 L183 34.5 L175 37 L172.5 45 L170 37 L162 34.5 Z"
        fill="#E05A42"
        stroke={outline}
        strokeWidth="1.5"
      />
      <circle cx="190" cy="25" r="3.5" fill="#E05A42" />
      <circle cx="155" cy="20" r="2.5" fill="#E05A42" opacity="0.6" />

      {/* ── LEFT FIGURE (coral outfit) ── */}
      {/* Back left arm (down) */}
      <path d="M80 95 Q60 110 56 136" stroke={skin} strokeWidth={16} strokeLinecap="round" />
      <path d="M80 95 Q60 110 56 136" stroke={outline} strokeWidth={sw} strokeLinecap="round" fill="none" />

      {/* Legs */}
      <path d="M86 146 Q78 170 72 196" stroke="#1C1917" strokeWidth={13} strokeLinecap="round" />
      <path d="M102 146 Q110 170 116 196" stroke="#1C1917" strokeWidth={13} strokeLinecap="round" />
      {/* Shoes left figure */}
      <ellipse cx="70" cy="197" rx="10" ry="5" fill="#1C1917" />
      <ellipse cx="116" cy="197" rx="10" ry="5" fill="#1C1917" />

      {/* Body (coral) */}
      <rect x="74" y="82" width="40" height="60" rx="12" fill="#E05A42" stroke={outline} strokeWidth={sw} />

      {/* Front right arm (raised for high-five) */}
      <path d="M114 92 Q140 72 158 56" stroke={skin} strokeWidth={16} strokeLinecap="round" />
      <path d="M114 92 Q140 72 158 56" stroke={outline} strokeWidth={sw} strokeLinecap="round" fill="none" />
      {/* Hand */}
      <circle cx="160" cy="52" r="11" fill={skin} stroke={outline} strokeWidth={sw} />

      {/* Head */}
      <circle cx="94" cy="56" r="26" fill={skin} stroke={outline} strokeWidth={sw} />
      {/* Hair */}
      <path
        d="M68 47 C70 25 118 25 120 47 Q116 33 94 33 Q72 33 68 47 Z"
        fill="#2D1B0E"
      />
      {/* Eyes */}
      <circle cx="87" cy="56" r="3.5" fill={outline} />
      <circle cx="101" cy="56" r="3.5" fill={outline} />
      {/* Eye shine */}
      <circle cx="88.5" cy="54.5" r="1.2" fill="white" />
      <circle cx="102.5" cy="54.5" r="1.2" fill="white" />
      {/* Smile */}
      <path d="M87 65 Q94 71 101 65" stroke={outline} strokeWidth="2.2" strokeLinecap="round" fill="none" />

      {/* ── RIGHT FIGURE (cream outfit) ── */}
      {/* Back right arm (down) */}
      <path d="M258 95 Q278 110 282 136" stroke={skin} strokeWidth={16} strokeLinecap="round" />
      <path d="M258 95 Q278 110 282 136" stroke={outline} strokeWidth={sw} strokeLinecap="round" fill="none" />

      {/* Legs */}
      <path d="M228 146 Q220 170 215 196" stroke="#1C1917" strokeWidth={13} strokeLinecap="round" />
      <path d="M254 146 Q262 170 268 196" stroke="#1C1917" strokeWidth={13} strokeLinecap="round" />
      {/* Shoes right figure */}
      <ellipse cx="214" cy="197" rx="10" ry="5" fill="#1C1917" />
      <ellipse cx="268" cy="197" rx="10" ry="5" fill="#1C1917" />

      {/* Body (cream) */}
      <rect x="226" y="82" width="40" height="60" rx="12" fill="#FDE8E4" stroke={outline} strokeWidth={sw} />

      {/* Front left arm (raised for high-five) */}
      <path d="M226 92 Q200 72 182 56" stroke={skin} strokeWidth={16} strokeLinecap="round" />
      <path d="M226 92 Q200 72 182 56" stroke={outline} strokeWidth={sw} strokeLinecap="round" fill="none" />
      {/* Hand */}
      <circle cx="180" cy="52" r="11" fill={skin} stroke={outline} strokeWidth={sw} />

      {/* Head */}
      <circle cx="246" cy="56" r="26" fill={skin} stroke={outline} strokeWidth={sw} />
      {/* Hair (different style — bun/different color) */}
      <path
        d="M220 47 C222 25 270 25 272 47 Q268 33 246 33 Q224 33 220 47 Z"
        fill="#1A1A2E"
      />
      {/* Bun */}
      <circle cx="246" cy="28" r="10" fill="#1A1A2E" stroke={outline} strokeWidth="1.5" />
      {/* Eyes */}
      <circle cx="239" cy="56" r="3.5" fill={outline} />
      <circle cx="253" cy="56" r="3.5" fill={outline} />
      {/* Eye shine */}
      <circle cx="240.5" cy="54.5" r="1.2" fill="white" />
      <circle cx="254.5" cy="54.5" r="1.2" fill="white" />
      {/* Smile */}
      <path d="M239 65 Q246 71 253 65" stroke={outline} strokeWidth="2.2" strokeLinecap="round" fill="none" />

      {/* Confetti dots */}
      <rect x="50" y="50" width="7" height="7" rx="2" fill="#E05A42" transform="rotate(15 50 50)" />
      <rect x="275" y="55" width="6" height="6" rx="1.5" fill="#FDE8E4" stroke={outline} strokeWidth="1" transform="rotate(-10 275 55)" />
      <rect x="140" y="10" width="5" height="5" rx="1" fill="#E05A42" opacity="0.5" transform="rotate(20 140 10)" />
    </svg>
  );
}
