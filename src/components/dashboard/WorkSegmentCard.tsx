import { StyleSheet, Text, View } from "react-native";
import { Button, Card, Kicker } from "@/components/ui";
import { colors, spacing, typography } from "@/theme";
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
    <Card style={styles.card}>
      <View style={styles.statusRow}>
        <View style={styles.dot} />
        <Kicker style={styles.label}>{`Currently ${MODE_LABEL[mode]}`}</Kicker>
      </View>

      <Text style={styles.whyLine}>
        Switches automatically when you arrive at or leave the office. Not right? Correct it below.
      </Text>

      <Button
        label={switching ? "Switching…" : `I'm actually in ${MODE_LABEL[other]}`}
        variant="secondary"
        size="sm"
        onPress={() => onSwitch(other)}
        disabled={switching}
        style={styles.switchButton}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: spacing.sm + 4 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 99, backgroundColor: colors.limeMid },
  label: { marginBottom: 0 },
  whyLine: { ...typography.caption, fontSize: 12.5, color: colors.textSecondary, marginTop: spacing.sm },
  switchButton: { marginTop: spacing.sm + 4, alignSelf: "flex-start" },
});
