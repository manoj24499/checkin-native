import type { ViewStyle } from "react-native";

// Gradients for expo-linear-gradient. Typed as readonly tuples so they can be
// passed straight to <LinearGradient colors={...} /> (it requires 2+ stops).
export const gradients = {
  /** Lime hero card fill, top-left -> bottom-right. */
  hero: ["#E4F76F", "#C7E63B"] as const,
  /** Lime fade behind the top of main screens (see ScreenBackground). */
  screen: ["#E6F58F", "#F1F8D2", "#F5F9E8"] as const,
  /** Stop positions for `screen` (mockup: 0% / 24% / 46% of the phone height,
   * re-based to the ~46%-tall gradient band ScreenBackground draws). */
  screenLocations: [0, 0.52, 1] as const,
  /** Subtle lime-tinted white card (e.g. the reimbursement summary card). */
  limeCard: ["#FFFFFF", "#F0F9C6"] as const,
  /** Pale lime selfie / photo placeholder. */
  placeholder: ["#EAF4C4", "#DCEBA5"] as const,
};

// Soft, ink-tinted shadows. iOS uses the shadow* props, Android `elevation`.
export const shadows = {
  /** Default white card. */
  card: {
    shadowColor: "#0E2410",
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  /** Smaller lift (list items, pills, round icon buttons). */
  soft: {
    shadowColor: "#0E2410",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  /** Lime hero card (greenish glow). */
  hero: {
    shadowColor: "#8DB61C",
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  /** Ink tiles / primary buttons (darker, tighter). */
  ink: {
    shadowColor: "#0E2410",
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  /** Raised centre tab button. */
  fab: {
    shadowColor: "#0E2410",
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  /** Floating lime tab bar. */
  tabBar: {
    shadowColor: "#5A780A",
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
} satisfies Record<string, ViewStyle>;
