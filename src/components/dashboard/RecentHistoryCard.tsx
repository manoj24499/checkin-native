import { Pressable, StyleSheet, Text, View } from "react-native";
import { DayHistoryRow } from "@/components/attendance/DayHistoryRow";
import type { DaySummary } from "@/utils/attendanceGrouping";
import { colors, radius, spacing, typography } from "@/theme";

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
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Last week</Text>
        <Pressable onPress={onSeeAll}>
          <Text style={styles.link}>See all</Text>
        </Pressable>
      </View>
      {preview.length === 0 ? (
        <Text style={styles.empty}>Your check-ins will show up here.</Text>
      ) : (
        <View style={styles.list}>
          {preview.map((d) => (
            <DayHistoryRow key={d.dateKey} day={d} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.sm + 3,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md - 2,
  },
  headerRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  title: { ...typography.bodyStrong, fontSize: 15, color: colors.textPrimary },
  link: { ...typography.bodyStrong, fontSize: 11.5, color: colors.primaryDark },
  empty: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.sm },
  list: { marginTop: spacing.xs },
});
