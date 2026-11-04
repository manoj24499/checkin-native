// Dark theme: warm near-black background with slightly lighter cards, light "ink" text, and brand orange
// (#ef6c00) as the accent. Token names are kept from the earlier light/lime themes so components still
// compile; `ink` is now the LIGHT text colour, and `onAccent` is the dark colour for text/glyphs that sit
// ON an orange fill (hero card, primary buttons).
export const colors = {
  background: "#0A0A0A",
  surface: "#1B1B1B",
  surfaceMuted: "#262626",
  /** Raised element on a muted track (active segment). */
  surfaceRaised: "#363636",
  border: "rgba(255,255,255,0.08)",

  primary: "#ef6c00",
  primaryDark: "#FF8A3D", // accent text on dark (links, active chip labels)
  primaryMuted: "rgba(239,108,0,0.18)", // orange tint behind active chips/badges
  primaryText: "#FFFFFF", // text/glyphs ON an orange fill
  primarySoftText: "#F7B27A",

  success: "#4CC38A",
  successMuted: "rgba(76,195,138,0.14)",
  warning: "#E5B54A",
  warningMuted: "rgba(229,181,74,0.14)",
  danger: "#F0746D",
  dangerMuted: "rgba(240,116,109,0.14)",

  textPrimary: "#F5F5F5",
  textSecondary: "#A3A3A3",
  textMuted: "#737373",
  textInverse: "#FFFFFF",

  // Panels that were already dark (live map, navigation) go a shade deeper than the page.
  panelDark: "#050505",
  panelDarker: "#000000",
  textOnDark: "#F5F5F5",
  textOnDarkMuted: "rgba(245,245,245,0.65)",

  overlay: "rgba(0,0,0,0.62)",

  // ---- Accent / ink tokens (names kept from the lime theme) ----
  /** Light text on the dark surfaces. */
  ink: "#F5F5F5",
  inkMuted: "rgba(245,245,245,0.65)",
  inkBorder: "rgba(255,255,255,0.14)",
  /** Text/glyphs that sit ON an orange fill: white (not black), so they read as part of the accent. */
  onAccent: "#FFFFFF",
  onAccentMuted: "rgba(255,255,255,0.82)",
  /** Brand orange: glyphs/labels on dark, the "you" marker, map route lines. */
  lime: "#ef6c00",
  limeStrong: "#ef6c00",
  limeMid: "#ef6c00",
  /** Lighter orange for text sitting on an orange tint. */
  limeDeep: "#FF8A3D",
  /** Tab bar fill. */
  limePale: "#262626",
  tabInactive: "#8A8A8A",
  /** Secondary text on orange surfaces (hero labels). */
  onLimeSecondary: "rgba(255,255,255,0.88)",
  /** Translucent white chips on top of the orange hero. */
  glass: "rgba(255,255,255,0.22)",
  /** Active tab pill. */
  glassStrong: "rgba(255,255,255,0.12)",
  warningText: "#E5B54A",
} as const;

export type ColorToken = keyof typeof colors;
