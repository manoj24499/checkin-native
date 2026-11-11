export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  /** Horizontal page gutter used by the mockups (20). */
  gutter: 20,
} as const;

// Redesign 2 radii. The original names are kept (re-valued) so existing styles compile; prefer the semantic
// names in new code.
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  // Sheet/dialog corner radius (bottom sheets, dark map/nav bottom panels).
  xl: 28,
  full: 999,
  pill: 999,

  /** Inputs (48 high text fields). */
  input: 14,
  /** Icon tiles, quick-action tiles, hero inner stat boxes (16-18). */
  tile: 18,
  /** Small stat boxes / inner chips. */
  chip: 16,
  /** Standard white cards ("glass"). */
  card: 22,
  /** Smaller cards (request rows, notification rows, login cards). */
  cardSm: 20,
  /** The dark presence hero panel. */
  hero: 28,
  /** Bottom sheet top corners. */
  sheet: 28,
  /** 54-high pill buttons (use radius.pill for any height). */
  button: 27,
} as const;
