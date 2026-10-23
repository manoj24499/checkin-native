import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { colors, radius } from "@/theme";

/**
 * success/warning/danger/neutral as before; "primary" = lime tint with olive
 * text (e.g. "PIN", "Photo", "Holiday"); "ink" = ink with lime text.
 */
type Tone = "success" | "warning" | "danger" | "neutral" | "primary" | "ink";

export function StatusBadge({ label, tone = "neutral", style }: { label: string; tone?: Tone; style?: ViewStyle }) {
  return (
    <View style={[styles.base, toneStyles[tone], style]}>
      <Text style={[styles.label, textToneStyles[tone]]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  label: { fontSize: 10.5, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
});

const toneStyles = StyleSheet.create({
  success: { backgroundColor: colors.successMuted },
  warning: { backgroundColor: colors.warningMuted },
  danger: { backgroundColor: colors.dangerMuted },
  neutral: { backgroundColor: colors.surfaceMuted },
  primary: { backgroundColor: colors.primaryMuted },
  ink: { backgroundColor: colors.ink },
});

const textToneStyles = StyleSheet.create({
  success: { color: colors.success },
  warning: { color: colors.warning },
  danger: { color: colors.danger },
  neutral: { color: colors.textSecondary },
  primary: { color: colors.limeDeep },
  ink: { color: colors.lime },
});
