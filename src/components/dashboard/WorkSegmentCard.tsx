import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "@/theme";
import type { WorkSegmentMode } from "@/types";

interface WorkSegmentCardProps {
  mode: WorkSegmentMode;
  onSwitch: (mode: WorkSegmentMode) => void;
  switching: boolean;
}

const MODE_LABEL: Record<WorkSegmentMode, string> = { OFFICE: "Office", FIELD: "Field" };

/** Live Field/Office indicator for FIELD-workMode employees — the mode
 * switches automatically via GPS (see /api/kiosk/location's
 * evaluateWorkSegment), but this lets them correct it by hand if detection
 * is late, wrong, or unavailable (e.g. indoors). */
export function WorkSegmentCard({ mode, onSwitch, switching }: WorkSegmentCardProps) {
  const other: WorkSegmentMode = mode === "FIELD" ? "OFFICE" : "FIELD";
  return (
    <View style={styles.card}>
      <View style={styles.statusRow}>
        <View style={styles.dot} />
        <Text style={styles.label}>CURRENTLY {MODE_LABEL[mode].toUpperCase()}</Text>
      </View>

      <Text style={styles.whyLine}>
        Switches automatically when you arrive at or leave the office. Not right? Correct it below.
      </Text>

      <Pressable
        onPress={() => onSwitch(other)}
        disabled={switching}
        style={({ pressed }) => [styles.switchButton, pressed && !switching && styles.switchButtonPressed]}
      >
        <Text style={styles.switchButtonLabel}>
          {switching ? "Switching…" : `I'm actually in ${MODE_LABEL[other]}`}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm + 4,
    marginTop: spacing.md,
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs + 1 },
  dot: { width: 9, height: 9, borderRadius: 99, backgroundColor: colors.primary },
  label: { ...typography.label, letterSpacing: 1.5, color: colors.textSecondary },
  whyLine: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm, maxWidth: 300 },
  switchButton: {
    marginTop: spacing.sm + 2,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md - 3,
    paddingVertical: spacing.sm - 1,
  },
  switchButtonPressed: { backgroundColor: colors.surfaceMuted },
  switchButtonLabel: { ...typography.bodyStrong, color: colors.primary, fontSize: 12.5 },
});
