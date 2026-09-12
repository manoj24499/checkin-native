export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  // Sheet/dialog corner radius from the "Inzivo Redesign" mockup (bottom
  // sheets and the blocking issue dialog use 14px, distinct from the 8px
  // cards/buttons use) — introduced for Phase 2/3, not yet consumed in
  // Phase 1's card/button restyle.
  xl: 14,
  full: 999,
} as const;
