// Font families are loaded via @expo-google-fonts/inter (see App.tsx's
// useFonts gate) — React Native needs a distinct family name per weight
// rather than a dynamic fontWeight, so each entry below pins both.
export const typography = {
  h1: { fontSize: 28, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  h2: { fontSize: 22, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
  h3: { fontSize: 18, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold" },
  body: { fontSize: 15, fontWeight: "400" as const, fontFamily: "Inter_400Regular" },
  bodyStrong: { fontSize: 15, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold" },
  caption: { fontSize: 13, fontWeight: "400" as const, fontFamily: "Inter_400Regular" },
  label: { fontSize: 13, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold" },
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
