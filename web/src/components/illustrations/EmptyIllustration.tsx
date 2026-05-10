export function EmptyIllustration({ className }: { className?: string }) {
  const skin = "#D4A574";
  const outline = "#1C1917";
  const sw = 2.5;

  return (
    <svg
      viewBox="0 0 220 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Ground line */}
      <ellipse cx="110" cy="210" rx="65" ry="10" fill="#EDE8E2" />

      {/* Flag pole */}
      <rect x="118" y="55" width="4" height="150" rx="2" fill="#1C1917" />

      {/* Flag (coral) */}
      <path d="M122 58 L158 72 L122 86 Z" fill="#E05A42" stroke={outline} strokeWidth={sw} strokeLinejoin="round" />

      {/* Decorative circles */}
      <circle cx="30" cy="80" r="12" fill="#FDE8E4" stroke={outline} strokeWidth={sw} />
      <circle cx="190" cy="130" r="8" fill="#FDE8E4" stroke={outline} strokeWidth={sw} />

      {/* Stars */}
      <path d="M55 45 L56.5 40 L58 45 L63 46.5 L58 48 L56.5 53 L55 48 L50 46.5 Z" fill="#E05A42" stroke={outline} strokeWidth="1.2" />
      <circle cx="175" cy="50" r="4" fill="#E05A42" opacity="0.5" />

      {/* ── FIGURE ── */}
      {/* Left arm (raised, planting flag with right) */}
      <path d="M88 100 Q72 88 65 72" stroke={skin} strokeWidth={15} strokeLinecap="round" />
      <path d="M88 100 Q72 88 65 72" stroke={outline} strokeWidth={sw} strokeLinecap="round" fill="none" />

      {/* Right arm (holding flag pole) */}
      <path d="M112 96 Q118 80 120 60" stroke={skin} strokeWidth={15} strokeLinecap="round" />
      <path d="M112 96 Q118 80 120 60" stroke={outline} strokeWidth={sw} strokeLinecap="round" fill="none" />

      {/* Legs */}
      <path d="M96 158 Q88 178 82 205" stroke="#1C1917" strokeWidth={13} strokeLinecap="round" />
      <path d="M110 158 Q118 178 124 205" stroke="#1C1917" strokeWidth={13} strokeLinecap="round" />
      {/* Shoes */}
      <ellipse cx="80" cy="206" rx="10" ry="5" fill="#1C1917" />
      <ellipse cx="126" cy="206" rx="10" ry="5" fill="#1C1917" />

      {/* Body (coral) */}
      <rect x="82" y="96" width="40" height="58" rx="12" fill="#E05A42" stroke={outline} strokeWidth={sw} />

      {/* Head */}
      <circle cx="102" cy="68" r="26" fill={skin} stroke={outline} strokeWidth={sw} />
      {/* Hair */}
      <path d="M76 58 C78 36 126 36 128 58 Q124 44 102 44 Q80 44 76 58 Z" fill="#2D1B0E" />
      {/* Eyes — looking up at flag */}
      <circle cx="96" cy="66" r="3.5" fill={outline} />
      <circle cx="108" cy="64" r="3.5" fill={outline} />
      <circle cx="97.5" cy="64.5" r="1.2" fill="white" />
      <circle cx="109.5" cy="62.5" r="1.2" fill="white" />
      {/* Determined mouth */}
      <path d="M96 76 Q102 80 108 76" stroke={outline} strokeWidth="2.2" strokeLinecap="round" fill="none" />
    </svg>
  );
}
