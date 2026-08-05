import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "@/theme";

type Tone = "success" | "warning" | "danger" | "neutral";

export function StatusBadge({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  return (
    <View style={[styles.base, toneStyles[tone]]}>
      <Text style={[styles.label, textToneStyles[tone]]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  label: { ...typography.label },
});

const toneStyles = StyleSheet.create({
  success: { backgroundColor: colors.successMuted },
  warning: { backgroundColor: colors.warningMuted },
  danger: { backgroundColor: colors.dangerMuted },
  neutral: { backgroundColor: colors.surfaceMuted },
});

const textToneStyles = StyleSheet.create({
  success: { color: colors.success },
  warning: { color: colors.warning },
  danger: { color: colors.danger },
  neutral: { color: colors.textSecondary },
});
