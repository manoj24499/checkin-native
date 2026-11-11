import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { colors, fontFamilies, radius } from "@/theme";

/**
 * Status chip (Requests.dc.html `.bd`): 11/600, padding 4/10, full pill.
 * success "Approved" (#1E7A4D on green tint), warning "Pending"/"Scheduled" (#8A5A00 on amber tint),
 * danger "Declined" (#B3261E on red tint), neutral (grey), primary (orange tint, accent text),
 * ink (dark fill, #FFB067 text).
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  label: { fontSize: 11, fontWeight: "600", fontFamily: fontFamilies.semiBold },
});

const toneStyles = StyleSheet.create({
  success: { backgroundColor: colors.successMuted },
  warning: { backgroundColor: colors.warningMuted },
  danger: { backgroundColor: colors.dangerMuted },
  neutral: { backgroundColor: "rgba(23,19,15,0.10)" },
  primary: { backgroundColor: colors.primaryMuted },
  ink: { backgroundColor: colors.ink },
});

const textToneStyles = StyleSheet.create({
  success: { color: colors.success },
  warning: { color: colors.warning },
  danger: { color: colors.danger },
  neutral: { color: colors.textSecondary },
  primary: { color: colors.accentText },
  ink: { color: colors.primarySoftText },
});
