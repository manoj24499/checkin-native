import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "@/theme";
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
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>✓</Text>
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.headline}>On leave today</Text>
        <Text style={styles.subline}>{TYPE_LABEL[type]} leave — check-in is disabled</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(46,111,82,0.35)",
    backgroundColor: colors.successMuted,
    padding: spacing.sm + 4,
    marginTop: spacing.md,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: "rgba(46,111,82,0.35)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  icon: { fontSize: 14, fontWeight: "800", color: colors.success },
  textWrap: { flex: 1 },
  headline: { ...typography.bodyStrong, fontSize: 14.5, color: colors.success },
  subline: { ...typography.caption, color: colors.textSecondary, marginTop: 1 },
});
