// Fonts are loaded in App.tsx (useFonts gate): Inter 400/500/600/700 for body text and Space Grotesk 500/700
// for display numbers and headings. React Native needs a distinct family name per weight rather than a
// dynamic fontWeight, so each entry below pins both.

/** Every loaded font family, by role. Prefer these over string literals. */
export const fontFamilies = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semiBold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  /** Space Grotesk Medium — secondary display text. */
  display500: "SpaceGrotesk_500Medium",
  /** Space Grotesk Bold — titles, timers, stat values, the INZIVO wordmark. */
  display700: "SpaceGrotesk_700Bold",
} as const;

const tabular = ["tabular-nums" as const];

export const typography = {
  /** Screen title (Profile/Requests 26-30px in the mockups). Space Grotesk. */
  h1: { fontSize: 28, fontWeight: "700" as const, fontFamily: fontFamilies.display700, letterSpacing: -0.4 },
  /** Greeting name / card title (22px). Space Grotesk. */
  h2: { fontSize: 22, fontWeight: "700" as const, fontFamily: fontFamilies.display700, letterSpacing: -0.2 },
  h3: { fontSize: 18, fontWeight: "600" as const, fontFamily: fontFamilies.semiBold },
  body: { fontSize: 15, fontWeight: "400" as const, fontFamily: fontFamilies.regular },
  bodyStrong: { fontSize: 15, fontWeight: "600" as const, fontFamily: fontFamilies.semiBold },
  caption: { fontSize: 13, fontWeight: "400" as const, fontFamily: fontFamilies.regular },
  label: { fontSize: 13, fontWeight: "600" as const, fontFamily: fontFamilies.semiBold },

  /** Small-caps kicker ("GOOD MORNING", "TODAY"): 11/600, +1.4 tracking. Upper-case the text; colour kicker. */
  kicker: {
    fontSize: 11,
    fontWeight: "600" as const,
    fontFamily: fontFamilies.semiBold,
    letterSpacing: 1.4,
  },
  /** Tiny caps label inside stat boxes ("IN AT", "CASUAL"): 10/600, +1.2 tracking. */
  statLabel: {
    fontSize: 10,
    fontWeight: "600" as const,
    fontFamily: fontFamilies.semiBold,
    letterSpacing: 1.2,
  },
  /** Big hero number / timer ("05:41:12", "8h 58m"). Space Grotesk 44. */
  display: {
    fontSize: 44,
    fontWeight: "700" as const,
    fontFamily: fontFamilies.display700,
    letterSpacing: -1,
    fontVariant: tabular,
  },
  /** Emphasised numbers (stat boxes, balances). Space Grotesk 17. */
  number: {
    fontSize: 17,
    fontWeight: "700" as const,
    fontFamily: fontFamilies.display700,
    fontVariant: tabular,
  },
  /** Section/card titles ("Today · 5h 41m"). Space Grotesk 17. */
  section: { fontSize: 17, fontWeight: "700" as const, fontFamily: fontFamilies.display700, letterSpacing: -0.1 },
  /** Card heading in Inter ("Leave left this year"): 15/600. */
  cardTitle: { fontSize: 15, fontWeight: "600" as const, fontFamily: fontFamilies.semiBold },
  /** Primary button label: 16/600. */
  button: { fontSize: 16, fontWeight: "600" as const, fontFamily: fontFamilies.semiBold },
  /** Accent text link ("History", "Forgot PIN?"): 13/500, colour accentText. */
  link: { fontSize: 13, fontWeight: "500" as const, fontFamily: fontFamilies.medium },
  /** INZIVO wordmark: Space Grotesk 15/700, +2 tracking. */
  wordmark: { fontSize: 15, fontWeight: "700" as const, fontFamily: fontFamilies.display700, letterSpacing: 2 },
};

/**
 * Legacy name for the Inter families (kept so existing styles compile). New code: use `fontFamilies`.
 */
export const fontFamily = {
  regular: fontFamilies.regular,
  medium: fontFamilies.medium,
  semiBold: fontFamilies.semiBold,
  bold: fontFamilies.bold,
  display500: fontFamilies.display500,
  display700: fontFamilies.display700,
} as const;
