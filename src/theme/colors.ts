// "Lime" light theme (see the Lime redesign brief): a soft lime gradient at
// the top of each screen fading into a pale lime-white background, a
// dark green-black "ink" for text, primary buttons and icon tiles, and a
// bright lime accent used on ink (button labels, icon glyphs) or as a fill
// behind ink (hero cards, the tab bar). Every token name from the previous
// orange theme is kept so unrelated code still compiles; only values moved,
// plus a handful of new lime/ink tokens at the bottom.
export const colors = {
  background: "#F5F9E8",
  surface: "#FFFFFF",
  surfaceMuted: "#EAF2D2",
  border: "rgba(14,36,16,0.08)",

  // Action colour (buttons, links, active states) is ink now, not orange:
  // a filled primary button is ink with lime text (`primaryText`).
  primary: "#0E2410",
  primaryDark: "#2E5A12", // text-on-light accent (links, active chip labels)
  primaryMuted: "rgba(201,230,67,0.32)", // lime tint behind active chips/badges
  primaryText: "#D8F25E", // text/glyphs ON a `primary` (ink) fill
  primarySoftText: "#D8F25E", // accent text legible on dark (ink) panels

  success: "#1F7A46",
  successMuted: "rgba(31,122,70,0.12)",
  warning: "#9A6B00",
  warningMuted: "rgba(190,150,20,0.14)",
  danger: "#B3453F",
  dangerMuted: "rgba(179,69,63,0.10)",

  textPrimary: "#0E2410",
  textSecondary: "#5E7258",
  textMuted: "#8A9C84",
  textInverse: "#FFFFFF",

  // Dark panels (live map, navigation) stay dark — dark green now. Route
  // lines and the "you" marker on them use `lime`.
  panelDark: "#0E2410",
  panelDarker: "#0E2410",
  textOnDark: "#F2FAD0",
  textOnDarkMuted: "rgba(242,250,208,0.65)",

  overlay: "rgba(14,36,16,0.55)",

  // ---- New in the Lime theme ----
  /** Dark green-black: text on light, dark buttons, icon tiles. Same value as `primary`. */
  ink: "#0E2410",
  /** Ink at reduced strength, for secondary text sitting on a lime fill (hero cards). */
  inkMuted: "rgba(14,36,16,0.6)",
  /** Hairline / outline on ink-tinted surfaces (input borders, dashed tiles). */
  inkBorder: "rgba(14,36,16,0.12)",
  /** Bright lime: glyphs/labels on ink, the "you" marker, map route lines. */
  lime: "#D8F25E",
  /** Slightly deeper lime used for fills (progress segments, hero gradient end). */
  limeStrong: "#C9E643",
  /** Mid lime-green, legible on both pale and lime backgrounds (dots, logo accent). */
  limeMid: "#8DB61C",
  /** Dark olive used for text sitting on a lime tint (`primaryMuted`). */
  limeDeep: "#2E5A12",
  /** Pale lime: tab bar fill, lighter lime surfaces. */
  limePale: "#E6F58F",
  /** Tab bar inactive label/icon colour. */
  tabInactive: "#4d6a2c",
  /** Secondary text on lime surfaces where `inkMuted` is too faint (hero labels). */
  onLimeSecondary: "#35501c",
  /** Translucent white "glass" chips on top of the lime hero. */
  glass: "rgba(255,255,255,0.55)",
  /** More opaque white for the active tab pill. */
  glassStrong: "rgba(255,255,255,0.7)",
  /** Darker text for warning notes on `warningMuted` backgrounds. */
  warningText: "#7a5a08",
} as const;

export type ColorToken = keyof typeof colors;
