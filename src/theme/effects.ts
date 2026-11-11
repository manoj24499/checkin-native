import { Easing, type ViewStyle } from "react-native";

// Gradients for expo-linear-gradient. Typed as readonly tuples so they can be passed straight to
// <LinearGradient colors={...} /> (it requires 2+ stops).
export const gradients = {
  /** THE brand gradient: #FFA64D -> #EF6C00 at 135deg. Pair with `gradientDirection.diagonal`. Dark text on it. */
  orange: ["#FFA64D", "#EF6C00"] as const,
  /** Vertical variant used by the 7-day bars (top light -> bottom deep). Pair with `gradientDirection.vertical`. */
  orangeVertical: ["#FFA64D", "#EF6C00"] as const,
  /** Gauge arc (left -> right): #FFC27A -> #EF6C00. */
  gauge: ["#FFC27A", "#EF6C00"] as const,
  /** Legacy: old orange hero fill. Now the same as `orange`. */
  hero: ["#FFA64D", "#EF6C00"] as const,
  /** Legacy wash behind the top of screens. The redesign uses AmbientGlow instead; kept for compilation. */
  screen: ["#FBE6D2", "#F9EFE5", "#F7F5F2"] as const,
  screenLocations: [0, 0.52, 1] as const,
  /** Subtle orange-tinted white card (e.g. the reimbursement summary card). */
  limeCard: ["#FFFFFF", "#FFF3E8"] as const,
  /** Pale selfie / photo placeholder. */
  placeholder: ["#F1EDE8", "#E6E0D9"] as const,
};

/** start/end points for LinearGradient. `diagonal` = CSS 135deg. */
export const gradientDirection = {
  diagonal: { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
  vertical: { start: { x: 0, y: 0 }, end: { x: 0, y: 1 } },
  horizontal: { start: { x: 0, y: 0 }, end: { x: 1, y: 0 } },
} as const;

/** Animation timings shared by Rise, AmbientGlow, pulses (all honour reduced motion). */
export const motion = {
  /** Rise-in: 0.8s, cubic-bezier(.2,.8,.2,1), translateY 26 -> 0, stagger 100ms. */
  riseDuration: 800,
  riseDistance: 26,
  riseStagger: 100,
  riseEasing: Easing.bezier(0.2, 0.8, 0.2, 1),
  /** Ambient glow drift: one half-cycle (out or back) of the 9-12s float loop. */
  floatDurations: [9000, 11000, 10000, 12000] as const,
  /** Avatar / live-dot pulse ring. */
  pulseDuration: 2400,
  /** Centre tab "breathe" ring. */
  breatheDuration: 2400,
  /** Primary button shimmer. */
  shimmerDuration: 2600,
} as const;

// Soft, ink-tinted shadows. iOS uses the shadow* props, Android `elevation`. The redesign is mostly flat
// (cards rely on a 1px border), so these are used sparingly.
export const shadows = {
  /** Default white card (the redesign's cards are flat; this is opt-in). */
  card: {
    shadowColor: "#17130F",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  /** Smaller lift (list items, pills, round icon buttons). */
  soft: {
    shadowColor: "#17130F",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  /** Dark hero panel (warm glow). */
  hero: {
    shadowColor: "#EF6C00",
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  /** Gradient buttons / tiles. */
  ink: {
    shadowColor: "#EF6C00",
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  /** Raised centre tab button. */
  fab: {
    shadowColor: "#EF6C00",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  /** Floating tab bar. */
  tabBar: {
    shadowColor: "#17130F",
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
} satisfies Record<string, ViewStyle>;
