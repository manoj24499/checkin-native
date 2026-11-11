import { StyleSheet, View, ViewProps } from "react-native";
import { colors, radius, shadows, spacing } from "@/theme";

type CardTone = "default" | "muted" | "lime" | "success" | "warning" | "danger";

interface CardProps extends ViewProps {
  /**
   * Background/border tint. "default" = white "glass" card, 1px rgba(23,19,15,.12) border, radius 22, flat;
   * "muted" = #F1EDE8, no border; "lime" = orange tint; success/warning/danger = matching *Muted fill with a
   * tinted border (status callouts such as "On leave today").
   */
  tone?: CardTone;
  /** Legacy (cards are flat now). Kept for compatibility; no effect. */
  flat?: boolean;
  /** Opt-in soft drop shadow (the redesign's cards are flat by default). */
  elevated?: boolean;
  /** "lg" (default) radius 22; "sm" radius 20 (request/notification rows). */
  size?: "lg" | "sm";
}

/** White rounded (22) card with a 1px hairline border. Any extra View props pass through. */
export function Card({ style, tone = "default", flat: _flat, elevated, size = "lg", ...props }: CardProps) {
  return (
    <View
      style={[
        styles.card,
        size === "sm" && styles.small,
        toneStyles[tone],
        elevated && shadows.card,
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  small: { borderRadius: radius.cardSm },
});

const toneStyles = StyleSheet.create({
  default: {},
  muted: { backgroundColor: colors.surfaceMuted, borderColor: "transparent" },
  lime: { backgroundColor: colors.primaryMuted, borderColor: "rgba(239,108,0,0.30)" },
  success: { backgroundColor: colors.successMuted, borderColor: "rgba(30,122,77,0.25)" },
  warning: { backgroundColor: colors.warningMuted, borderColor: "rgba(138,90,0,0.22)" },
  danger: { backgroundColor: colors.dangerMuted, borderColor: colors.dangerBorder },
});
