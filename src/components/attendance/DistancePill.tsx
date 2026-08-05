import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "@/theme";
import { formatDistance } from "@/utils/geo";

interface DistancePillProps {
  distanceMeters: number | null;
  withinRadius: boolean | null;
}

export function DistancePill({ distanceMeters, withinRadius }: DistancePillProps) {
  if (distanceMeters === null || withinRadius === null) return null;
  return (
    <View style={[styles.pill, { backgroundColor: withinRadius ? colors.successMuted : colors.dangerMuted }]}>
      <Text style={[styles.text, { color: withinRadius ? colors.success : colors.danger }]}>
        {withinRadius ? "In range" : "Out of range"} · {formatDistance(distanceMeters)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  text: { ...typography.label },
});
