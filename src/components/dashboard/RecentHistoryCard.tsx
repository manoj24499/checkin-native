import { StyleSheet, Text, View } from "react-native";
import { Card, SectionHeader } from "@/components/ui";
import { DayHistoryRow } from "@/components/attendance/DayHistoryRow";
import type { DaySummary } from "@/utils/attendanceGrouping";
import { colors, spacing, typography } from "@/theme";

/** Lightweight "last few days" preview on the Home screen — does not
 * replace AttendanceHistoryScreen's full infinite-scroll list (that stays a
 * separate screen, reachable via "See all"), this is just a fast-glance
 * slice fed by the same recent-attendance data DashboardScreen already
 * fetches for the weekly chart. */
export function RecentHistoryCard({
  days,
  onSeeAll,
}: {
  days: DaySummary[];
  onSeeAll: () => void;
}) {
  const preview = days.slice(0, 5);

  return (
    <View>
      <SectionHeader title="Last week" onAction={onSeeAll} actionLabel="See all" />
      <Card style={styles.card}>
        {preview.length === 0 ? (
          <Text style={styles.empty}>Your check-ins will show up here.</Text>
        ) : (
          preview.map((d, i) => <DayHistoryRow key={d.dateKey} day={d} divider={i > 0} />)
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: spacing.xs + 2, paddingHorizontal: spacing.md - 2 },
  empty: { ...typography.caption, color: colors.textSecondary, paddingVertical: spacing.sm + 2 },
});
