export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// Lime theme: everything is rounder. The original four names are kept (and
// re-valued) so existing styles still compile; prefer the semantic names
// below in new code.
export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  // Sheet/dialog corner radius (bottom sheets, dark map/nav bottom panels).
  xl: 30,
  full: 999,

  /** Inputs, PIN boxes, notes/callouts. */
  input: 14,
  /** Icon tiles and quick-action tiles (18-20 in the mockup). */
  tile: 18,
  /** Standard white cards. */
  card: 26,
  /** The lime hero card. */
  hero: 30,
  /** Bottom sheet top corners. */
  sheet: 30,
  /** 50-high pill buttons. */
  button: 25,
} as const;
