import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBadge } from "@/components/ui";
import type { DaySummary } from "@/utils/attendanceGrouping";
import { formatDuration } from "@/utils/attendanceGrouping";
import { colors, spacing, typography } from "@/theme";

const DAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI"];

function startOfWeek(d: Date) {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function WeeklyHoursChart({ days }: { days: DaySummary[] }) {
  const monday = startOfWeek(new Date());
  const weekDays = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const match = days.find((x) => x.dateKey === key);
    return { label: DAY_LABELS[i], hoursMs: match?.durationMs ?? 0 };
  });

  const totalMs = weekDays.reduce((sum, d) => sum + d.hoursMs, 0);
  const maxMs = Math.max(8 * 3_600_000, ...weekDays.map((d) => d.hoursMs));

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={styles.title}>This week</Text>
        <StatusBadge label={formatDuration(totalMs)} tone="primary" />
      </View>
      <View style={styles.chart}>
        {weekDays.map((d) => (
          <View key={d.label} style={styles.col}>
            <View style={styles.barTrack}>
              {d.hoursMs > 0 ? (
                <LinearGradient
                  colors={[colors.lime, "#7FAE12"]}
                  style={[styles.bar, { height: `${Math.max(4, (d.hoursMs / maxMs) * 100)}%` }]}
                />
              ) : (
                <View style={[styles.bar, styles.barEmpty]} />
              )}
            </View>
            <Text style={styles.dayLabel}>{d.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { ...typography.bodyStrong, fontSize: 14, color: colors.ink },
  chart: { flexDirection: "row", gap: spacing.sm + 2, marginTop: spacing.md, height: 92 },
  col: { flex: 1, alignItems: "center", gap: spacing.xs + 2 },
  barTrack: { flex: 1, width: "100%", justifyContent: "flex-end" },
  bar: { width: "100%", borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  barEmpty: { height: "8%", backgroundColor: colors.surfaceMuted },
  dayLabel: { fontSize: 9.5, letterSpacing: 1, color: colors.textMuted, fontWeight: "600" },
});
