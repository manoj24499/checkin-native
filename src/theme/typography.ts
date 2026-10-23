// Font families are loaded via @expo-google-fonts/inter (see App.tsx's
// useFonts gate) — React Native needs a distinct family name per weight
// rather than a dynamic fontWeight, so each entry below pins both.
export const typography = {
  h1: { fontSize: 28, fontWeight: "700" as const, fontFamily: "Inter_700Bold", letterSpacing: -0.6 },
  h2: { fontSize: 22, fontWeight: "700" as const, fontFamily: "Inter_700Bold", letterSpacing: -0.4 },
  h3: { fontSize: 18, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold" },
  body: { fontSize: 15, fontWeight: "400" as const, fontFamily: "Inter_400Regular" },
  bodyStrong: { fontSize: 15, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold" },
  caption: { fontSize: 13, fontWeight: "400" as const, fontFamily: "Inter_400Regular" },
  label: { fontSize: 13, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold" },

  // ---- Lime theme additions ----
  /** Small-caps section kicker ("LIVE LOCATION"). Pass the text upper-cased. */
  kicker: {
    fontSize: 10.5,
    fontWeight: "600" as const,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.5,
  },
  /** Big hero number ("3h 12m", "₹2,840"). */
  display: {
    fontSize: 44,
    fontWeight: "700" as const,
    fontFamily: "Inter_700Bold",
    letterSpacing: -1.6,
    fontVariant: ["tabular-nums" as const],
  },
  /** Medium emphasised numbers (list-row values, stat tiles). */
  number: {
    fontSize: 15,
    fontWeight: "700" as const,
    fontFamily: "Inter_700Bold",
    fontVariant: ["tabular-nums" as const],
  },
  /** Section header titles ("Today"). */
  section: { fontSize: 17, fontWeight: "700" as const, fontFamily: "Inter_700Bold", letterSpacing: -0.2 },
};

// Standalone family names for one-off text styles that don't go through the
// typography scale above (e.g. the 42px elapsed-time clock, which uses
// weight 500 — Medium — not covered by any typography.* entry).
export const fontFamily = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semiBold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
} as const;
