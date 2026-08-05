// Warm off-white / brand-orange palette (see design doc "Futuristic Check-In
// Redesign", turn 2). Token names are kept stable from the previous
// blue-based theme so components don't all need renaming — only values (and
// a few new dark-panel tokens) changed.
export const colors = {
  background: "#FBF9F7",
  surface: "#FFFFFF",
  surfaceMuted: "#F4F1ED",
  border: "rgba(26,21,18,0.10)",

  primary: "#F06400",
  primaryDark: "#C25200",
  primaryMuted: "rgba(240,100,0,0.08)",
  primaryText: "#FFFFFF",
  primarySoftText: "#F7B27A", // orange text legible on dark panels

  success: "#2E6F52",
  successMuted: "rgba(46,111,82,0.10)",
  warning: "#B8860B",
  warningMuted: "rgba(184,134,11,0.10)",
  danger: "#B3453F",
  dangerMuted: "rgba(179,69,63,0.10)",

  textPrimary: "#1A1512",
  textSecondary: "#86776F",
  textMuted: "#A0938B",
  textInverse: "#FFFFFF",

  // Dark "presence" panels (dashboard hero, live map) and their text.
  panelDark: "#241E19",
  panelDarker: "#231D18",
  textOnDark: "#F7F3EF",
  textOnDarkMuted: "rgba(247,243,239,0.6)",

  overlay: "rgba(26,21,18,0.55)",
} as const;

export type ColorToken = keyof typeof colors;
