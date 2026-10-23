import { StyleSheet, Text, View } from "react-native";
import { colors, radius, typography } from "@/theme";
import { formatDistance } from "@/utils/geo";

interface DistancePillProps {
  distanceMeters: number | null;
  withinRadius: boolean | null;
}

export function DistancePill({ distanceMeters, withinRadius }: DistancePillProps) {
  if (distanceMeters === null || withinRadius === null) return null;
  const tint = withinRadius ? colors.success : colors.danger;
  return (
    <View style={[styles.pill, { backgroundColor: withinRadius ? colors.successMuted : colors.dangerMuted }]}>
      <View style={[styles.dot, { backgroundColor: tint }]} />
      <Text style={[styles.text, { color: tint }]}>
        {withinRadius ? "In range" : "Out of range"} · {formatDistance(distanceMeters)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  dot: { width: 7, height: 7, borderRadius: 99 },
  text: { ...typography.label, fontSize: 12.5 },
});
