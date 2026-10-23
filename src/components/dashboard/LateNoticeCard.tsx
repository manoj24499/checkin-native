import { StyleSheet, Text, View } from "react-native";
import { Card, IconTile } from "@/components/ui";
import { colors, spacing, typography } from "@/theme";

interface LateNoticeCardProps {
  leaveType: "PERMISSION" | "HALF_DAY";
  lateMinutes: number | null;
}

// Permission = warning tone, half-day = danger tone (Card's tinted tones).
const TONE = {
  PERMISSION: { card: "warning", tint: colors.warning },
  HALF_DAY: { card: "danger", tint: colors.danger },
} as const;

export function LateNoticeCard({ leaveType, lateMinutes }: LateNoticeCardProps) {
  const tone = TONE[leaveType];

  return (
    <Card tone={tone.card} style={styles.card}>
      <IconTile glyph="!" tone={tone.card} />
      <View style={styles.textWrap}>
        <Text style={[styles.headline, { color: tone.tint }]}>
          {leaveType === "PERMISSION" ? "Permission" : "Half-day leave"}
        </Text>
        <Text style={styles.subline}>Checked in {lateMinutes} min late today</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 4,
    padding: spacing.sm + 6,
    marginTop: spacing.sm + 4,
  },
  textWrap: { flex: 1 },
  headline: { ...typography.bodyStrong, fontSize: 14.5 },
  subline: { ...typography.caption, color: colors.textSecondary, marginTop: 1 },
});
