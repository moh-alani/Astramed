export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={compact ? "wordmark compact" : "wordmark"}>
      <svg viewBox="0 0 32 32" width={compact ? 22 : 26} height={compact ? 22 : 26} aria-hidden="true">
        <circle cx="16" cy="16" r="14.5" fill="none" stroke="currentColor" strokeOpacity="0.35" />
        <path
          d="M5 17h6l2.5-6 4 11 3-7H27"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="wordmark-text">ASTRAMED</span>
    </span>
  );
}

/** Schematic, not to scale: the spacecraft marker is illustrative, not a computed position. */
export function Trajectory({ day }: { day: number }) {
  return (
    <svg className="trajectory" viewBox="0 0 420 300" role="presentation">
      <defs>
        <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M28 0H0V28" fill="none" stroke="var(--line)" strokeWidth="0.6" />
        </pattern>
      </defs>
      <rect x="0" y="0" width="420" height="300" fill="url(#grid)" opacity="0.55" />
      <path d="M60 230 C 140 60, 300 40, 370 120" fill="none" stroke="var(--line-strong)" strokeWidth="1.5" />
      <path d="M60 230 C 105 140, 160 96, 205 82" fill="none" stroke="var(--accent)" strokeWidth="2" />
      <circle cx="60" cy="230" r="11" fill="var(--surface-2)" stroke="var(--info)" strokeWidth="1.5" />
      <circle cx="370" cy="120" r="8" fill="var(--surface-2)" stroke="var(--warn)" strokeWidth="1.5" />
      <circle cx="205" cy="82" r="5" fill="var(--accent)" />
      <circle cx="205" cy="82" r="11" fill="none" stroke="var(--accent)" strokeOpacity="0.35" />
      <text x="60" y="262" textAnchor="middle" className="traj-label">Earth</text>
      <text x="370" y="150" textAnchor="middle" className="traj-label">Mars</text>
      <text x="205" y="62" textAnchor="middle" className="traj-label strong">Day {day}</text>
    </svg>
  );
}
