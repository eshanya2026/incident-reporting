import React from 'react';

interface StatlogLogoProps {
  /** "light" for white backgrounds, "dark" for the red brand panel. */
  tone?: 'light' | 'dark';
  /** Delay (ms) before the heartbeat line draws in. */
  delay?: number;
  /** Tailwind font-size classes; every part of the mark scales in `em`. */
  className?: string;
}

/**
 * STATLOG wordmark: heavy "STAT" + lighter "LOG" whose O is a ring with a live pulse dot,
 * over a heartbeat line that draws in left to right.
 */
export default function StatlogLogo({ tone = 'light', delay = 0, className = 'text-3xl' }: StatlogLogoProps) {
  const dark = tone === 'dark';
  const statColor = dark ? 'text-white' : 'text-[#68151A]';
  const logColor = dark
    ? 'text-[#FDECEC]'
    : 'bg-gradient-to-r from-[#C62828] to-[#E53935] bg-clip-text text-transparent';
  const ringColor = dark ? 'border-[#FDECEC]' : 'border-[#C62828]';
  const dotColor = dark ? 'bg-white' : 'bg-[#E53935]';
  const lineColor = dark ? 'bg-white/60' : 'bg-[#C62828]/70';
  const blipColor = dark ? '#FFFFFF' : '#C62828';

  return (
    <span
      role="img"
      aria-label="Statlog"
      className={`inline-flex flex-col select-none leading-none ${className}`}
    >
      <span aria-hidden="true" className="inline-flex items-baseline font-black tracking-[0.1em]">
        <span className={statColor}>STAT</span>
        <span className={`${logColor} font-light`}>L</span>
        {/* The "O": a ring with a softly pulsing dot */}
        <span
          className={`relative inline-block w-[0.72em] h-[0.72em] mx-[0.07em] rounded-full border-[0.11em] ${ringColor}`}
        >
          <span
            className={`absolute inset-0 m-auto w-[0.24em] h-[0.24em] rounded-full ${dotColor} animate-ping opacity-60`}
          ></span>
          <span className={`absolute inset-0 m-auto w-[0.24em] h-[0.24em] rounded-full ${dotColor}`}></span>
        </span>
        <span className={`${logColor} font-light`}>G</span>
      </span>

      {/* Heartbeat line */}
      <span
        aria-hidden="true"
        style={{ '--d': `${delay}ms` } as React.CSSProperties}
        className="statlog-heartbeat mt-[0.14em] flex items-center"
      >
        <span className={`h-[0.045em] min-h-[2px] flex-1 rounded-full ${lineColor}`}></span>
        <svg viewBox="0 0 48 20" className="h-[0.42em] w-[1.1em] shrink-0 overflow-visible" fill="none">
          <path
            d="M0 10 H12 L16 10 L20 1 L26 19 L30 6 L33 10 H48"
            stroke={blipColor}
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className={`h-[0.045em] min-h-[2px] w-[0.5em] rounded-full ${lineColor}`}></span>
      </span>
    </span>
  );
}
