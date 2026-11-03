import React from 'react';

interface BrandLogoProps {
  /** "light" for white backgrounds, "dark" for the red brand panel. */
  tone?: 'light' | 'dark';
  /** Delay (ms) before the pulse mark draws in. */
  delay?: number;
  /** Tailwind font-size classes; every part of the mark scales in `em`. */
  className?: string;
}

/**
 * Wordmark: "Incident" in deep ink + "Reporting" in the maroon brand gradient, followed by a
 * compact ECG pulse that draws in once and ends in a softly pulsing dot.
 */
export default function BrandLogo({ tone = 'light', delay = 0, className = 'text-3xl' }: BrandLogoProps) {
  const dark = tone === 'dark';
  const strong = dark ? 'text-white' : 'text-[#2E0B11]';
  const accent = dark
    ? 'bg-gradient-to-r from-[#F6DFC2] to-[#E8BF8A] bg-clip-text text-transparent'
    : 'bg-gradient-to-r from-[#7A2430] via-[#962F3B] to-[#B5484F] bg-clip-text text-transparent';
  const stroke = dark ? '#F6DFC2' : '#962F3B';
  const dot = dark ? 'bg-[#F6DFC2]' : 'bg-[#B5484F]';

  return (
    <span role="img" aria-label="Incident Reporting" className={`inline-block leading-[1.05] select-none ${className}`}>
      {/* Wraps to two lines wherever one line doesn't fit. The pulse is glued to "Reporting" so it
          always sits right after the word instead of drifting to the far edge when it wraps. */}
      <span aria-hidden="true" className="font-extrabold tracking-[-0.02em]">
        <span className={strong}>Incident</span>{' '}
        <span className="whitespace-nowrap">
          <span className={accent}>Reporting</span>
          {/* ECG pulse ending in a live dot */}
          <span className="relative inline-flex items-center align-middle ml-[0.3em] -translate-y-[0.02em]">
            <svg
              viewBox="0 0 40 20"
              style={{ '--d': `${delay}ms` } as React.CSSProperties}
              className="brand-heartbeat h-[0.78em] w-[1.55em] overflow-visible"
              fill="none"
            >
              <path
                d="M1 11 H10 L13 11 L16.5 3 L21 18 L24.5 7 L27 11 H35"
                stroke={stroke}
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="relative ml-[0.04em] w-[0.22em] h-[0.22em]">
              <span className={`absolute inset-0 rounded-full ${dot} animate-ping opacity-50`}></span>
              <span className={`absolute inset-0 rounded-full ${dot}`}></span>
            </span>
          </span>
        </span>
      </span>
    </span>
  );
}
