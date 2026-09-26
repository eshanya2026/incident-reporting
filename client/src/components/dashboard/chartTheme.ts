// Chart colours and mark specs. Colours come from the dataviz reference palette and were run
// through its validator for the light surface (the app has no dark mode):
//  - two-series categorical (slots 1–2): all checks pass
//  - severity ordinal ramp (blue 250→650): all checks pass
// Status colours are reserved for good/bad meaning and always shown with an icon and a label.

export const SERIES = {
  1: '#2a78d6', // blue — single-series bars, "Reported"
  2: '#eb6834', // orange — "Closed"
};

/** Severity 1 → 5 (ordered), one hue light → dark. */
export const SEVERITY_RAMP: Record<number, string> = {
  1: '#86b6ef',
  2: '#5598e7',
  3: '#2a78d6',
  4: '#1c5cab',
  5: '#104281',
};

export const STATUS = {
  good: '#0ca30c',
  critical: '#d03b3b',
};

export const CHART = {
  grid: '#E5E7EB', // hairline, solid, one step off the white surface
  axisText: '#64748B', // text-secondary token
  mutedText: '#94A3B8',
  font: 12,
  barSize: 22, // ≤ 24px
};
