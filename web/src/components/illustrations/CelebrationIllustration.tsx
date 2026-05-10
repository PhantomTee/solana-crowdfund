export function CelebrationIllustration({ className }: { className?: string }) {
  const skin = "#D4A574";
  const outline = "#1C1917";
  const sw = 2.5;

  return (
    <svg
      viewBox="0 0 200 230"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Ground */}
      <ellipse cx="100" cy="215" rx="55" ry="8" fill="#EDE8E2" />

      {/* Confetti */}
      <rect x="28" y="40" width="8" height="8" rx="2" fill="#E05A42" transform="rotate(20 28 40)" />
      <rect x="162" y="35" width="7" height="7" rx="2" fill="#FDE8E4" stroke={outline} strokeWidth="1" transform="rotate(-15 162 35)" />
      <rect x="45" y="70" width="5" height="5" rx="1" fill="#E05A42" opacity="0.5" transform="rotate(30 45 70)" />
      <rect x="150" y="75" width="6" height="6" rx="1.5" fill="#E05A42" transform="rotate(-25 150 75)" />
      <circle cx="35" cy="110" r="4" fill="#FDE8E4" stroke={outline} strokeWidth="1.5" />
      <circle cx="165" cy="100" r="5" fill="#FDE8E4" stroke={outline} strokeWidth="1.5" />

      {/* Stars */}
      <path d="M25 55 L26.5 49 L28 55 L34 56.5 L28 58 L26.5 64 L25 58 L19 56.5 Z" fill="#E05A42" stroke={outline} strokeWidth="1.2" />
      <path d="M170 60 L171.2 55.5 L172.4 60 L177 61.2 L172.4 62.4 L171.2 67 L170 62.4 L165.4 61.2 Z" fill="#E05A42" stroke={outline} strokeWidth="1" />

      {/* ── FIGURE ── */}
      {/* Left arm raised up-left */}
      <path d="M80 98 Q58 75 44 55" stroke={skin} strokeWidth={16} strokeLinecap="round" />
      <path d="M80 98 Q58 75 44 55" stroke={outline} strokeWidth={sw} strokeLinecap="round" fill="none" />
      {/* Left hand */}
      <circle cx="41" cy="52" r="11" fill={skin} stroke={outline} strokeWidth={sw} />

      {/* Right arm raised up-right */}
      <path d="M120 98 Q142 75 156 55" stroke={skin} strokeWidth={16} strokeLinecap="round" />
      <path d="M120 98 Q142 75 156 55" stroke={outline} strokeWidth={sw} strokeLinecap="round" fill="none" />
      {/* Right hand */}
      <circle cx="159" cy="52" r="11" fill={skin} stroke={outline} strokeWidth={sw} />

      {/* Legs (jumping/standing on tiptoes) */}
      <path d="M94 165 Q86 185 80 210" stroke="#1C1917" strokeWidth={13} strokeLinecap="round" />
      <path d="M108 165 Q116 185 122 210" stroke="#1C1917" strokeWidth={13} strokeLinecap="round" />
      {/* Shoes */}
      <ellipse cx="79" cy="211" rx="10" ry="5" fill="#1C1917" />
      <ellipse cx="123" cy="211" rx="10" ry="5" fill="#1C1917" />

      {/* Body (coral) */}
      <rect x="80" y="90" width="42" height="70" rx="13" fill="#E05A42" stroke={outline} strokeWidth={sw} />

      {/* Head */}
      <circle cx="101" cy="62" r="28" fill={skin} stroke={outline} strokeWidth={sw} />
      {/* Hair */}
      <path d="M73 52 C75 28 127 28 129 52 Q125 36 101 36 Q77 36 73 52 Z" fill="#1A1A2E" />
      {/* Bun detail */}
      <circle cx="101" cy="32" r="9" fill="#1A1A2E" stroke={outline} strokeWidth="1.5" />

      {/* Eyes — wide, excited */}
      <circle cx="94" cy="62" r="4.5" fill="white" stroke={outline} strokeWidth={sw} />
      <circle cx="108" cy="62" r="4.5" fill="white" stroke={outline} strokeWidth={sw} />
      <circle cx="94" cy="62" r="2.5" fill={outline} />
      <circle cx="108" cy="62" r="2.5" fill={outline} />
      <circle cx="95" cy="61" r="1" fill="white" />
      <circle cx="109" cy="61" r="1" fill="white" />

      {/* Big smile */}
      <path d="M91 74 Q101 83 111 74" stroke={outline} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* Teeth */}
      <path d="M93 75 Q101 82 109 75 Q101 80 93 75 Z" fill="white" />
    </svg>
  );
}
