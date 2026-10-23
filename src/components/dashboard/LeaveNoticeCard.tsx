import { StyleSheet, Text, View } from "react-native";
import { Card, IconTile } from "@/components/ui";
import { colors, spacing, typography } from "@/theme";
import type { TimeOffType } from "@/types";

interface LeaveNoticeCardProps {
  type: TimeOffType;
}

const TYPE_LABEL: Record<TimeOffType, string> = {
  CASUAL: "Casual",
  SICK: "Sick",
  EARNED: "Earned",
};

// Same shape as LateNoticeCard, but a success tone — this is a positive,
// approved state, not a warning like a late check-in.
export function LeaveNoticeCard({ type }: LeaveNoticeCardProps) {
  return (
    <Card tone="success" style={styles.card}>
      <IconTile icon="check" tone="success" />
      <View style={styles.textWrap}>
        <Text style={styles.headline}>On leave today</Text>
        <Text style={styles.subline}>{TYPE_LABEL[type]} leave — check-in is disabled</Text>
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
  headline: { ...typography.bodyStrong, fontSize: 14.5, color: colors.success },
  subline: { ...typography.caption, color: colors.textSecondary, marginTop: 1 },
});
