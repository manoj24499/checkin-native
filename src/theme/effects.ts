import type { ViewStyle } from "react-native";

// Gradients for expo-linear-gradient. Typed as readonly tuples so they can be
// passed straight to <LinearGradient colors={...} /> (it requires 2+ stops).
export const gradients = {
  /** Orange hero card fill, top-left -> bottom-right. */
  hero: ["#ef6c00", "#D9480A"] as const,
  /** Orange fade behind the top of main screens (see ScreenBackground). */
  screen: ["#3A1E0A", "#1A0F08", "#0A0A0A"] as const,
  /** Stop positions for `screen` (mockup: 0% / 24% / 46% of the phone height,
   * re-based to the ~46%-tall gradient band ScreenBackground draws). */
  screenLocations: [0, 0.52, 1] as const,
  /** Subtle orange-tinted white card (e.g. the reimbursement summary card). */
  limeCard: ["#222222", "#2B1E16"] as const,
  /** Pale orange selfie / photo placeholder. */
  placeholder: ["#2A2A2A", "#333333"] as const,
};

// Soft, ink-tinted shadows. iOS uses the shadow* props, Android `elevation`.
export const shadows = {
  /** Default white card. */
  card: {
    shadowColor: "#000000",
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  /** Smaller lift (list items, pills, round icon buttons). */
  soft: {
    shadowColor: "#000000",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  /** Orange hero card (warm glow). */
  hero: {
    shadowColor: "#ef6c00",
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  /** Ink tiles / primary buttons (darker, tighter). */
  ink: {
    shadowColor: "#ef6c00",
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  /** Raised centre tab button. */
  fab: {
    shadowColor: "#ef6c00",
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  /** Floating tab bar. */
  tabBar: {
    shadowColor: "#000000",
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
} satisfies Record<string, ViewStyle>;
