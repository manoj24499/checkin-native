import { StyleSheet, View, ViewProps } from "react-native";
import { colors, radius, shadows, spacing } from "@/theme";

type CardTone = "default" | "muted" | "lime" | "success" | "warning" | "danger";

interface CardProps extends ViewProps {
  /**
   * Background/border tint. "default" = white with a soft ink shadow;
   * "muted" = surfaceMuted, no shadow; "lime" = lime tint (primaryMuted);
   * success/warning/danger = the matching *Muted fill with a tinted border
   * (status callouts such as "On leave today").
   */
  tone?: CardTone;
  /** Drop the shadow (e.g. cards nested inside other cards). */
  flat?: boolean;
}

/** White rounded (26) card with soft shadow. Any extra View props pass through. */
export function Card({ style, tone = "default", flat, ...props }: CardProps) {
  return (
    <View
      style={[styles.card, tone === "default" && !flat && shadows.card, toneStyles[tone], style]}
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
    borderColor: "rgba(14,36,16,0.06)",
  },
});

const toneStyles = StyleSheet.create({
  default: {},
  muted: { backgroundColor: colors.surfaceMuted, borderColor: "transparent" },
  lime: { backgroundColor: colors.primaryMuted, borderColor: "rgba(160,200,30,0.35)" },
  success: { backgroundColor: colors.successMuted, borderColor: "rgba(31,122,70,0.3)" },
  warning: { backgroundColor: colors.warningMuted, borderColor: "rgba(154,107,0,0.3)" },
  danger: { backgroundColor: colors.dangerMuted, borderColor: "rgba(179,69,63,0.3)" },
});
