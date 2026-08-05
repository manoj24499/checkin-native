import { StyleSheet, Text, View } from "react-native";
import type { DaySummary } from "@/utils/attendanceGrouping";
import { formatDuration } from "@/utils/attendanceGrouping";
import { colors, spacing } from "@/theme";

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function DayHistoryRow({ day }: { day: DaySummary }) {
  const dayNum = day.date.getDate();
  const dow = day.date.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase();

  const span = day.checkIn
    ? `${timeOf(day.checkIn.timestamp)} → ${day.checkOut ? timeOf(day.checkOut.timestamp) : "live"}`
    : day.checkOut
      ? `→ ${timeOf(day.checkOut.timestamp)}`
      : "—";

  const dur = day.durationMs !== null ? formatDuration(day.durationMs) : "—";
  const method = day.checkIn?.method ?? day.checkOut?.method ?? "—";

  const startOfDay = new Date(day.date);
  startOfDay.setHours(0, 0, 0, 0);
  const checkInOffsetMs = day.checkIn
    ? new Date(day.checkIn.timestamp).getTime() - startOfDay.getTime()
    : 0;
  const spanMs =
    day.durationMs ?? (day.checkIn ? Date.now() - new Date(day.checkIn.timestamp).getTime() : 0);
  const leftPct = Math.max(0, Math.min(100, (checkInOffsetMs / DAY_MS) * 100));
  const widthPct = Math.max(2, Math.min(100 - leftPct, (spanMs / DAY_MS) * 100));

  return (
    <View style={styles.row}>
      <View style={styles.dateCol}>
        <Text style={styles.dayNum}>{dayNum}</Text>
        <Text style={styles.dow}>{dow}</Text>
      </View>
      <View style={styles.middleCol}>
        <View style={styles.spanRow}>
          <Text style={styles.span}>{span}</Text>
          <Text style={styles.dur}>{dur}</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { left: `${leftPct}%`, width: `${widthPct}%` }]} />
        </View>
      </View>
      <View style={styles.tag}>
        <Text style={styles.tagLabel}>{method}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dateCol: { width: 38, alignItems: "flex-start" },
  dayNum: { fontSize: 16, fontWeight: "600", color: colors.textPrimary, fontVariant: ["tabular-nums"] },
  dow: { fontSize: 9, letterSpacing: 1, color: colors.textMuted, marginTop: 4, fontWeight: "600" },
  middleCol: { flex: 1, minWidth: 0 },
  spanRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
  span: { fontSize: 13, color: colors.textPrimary, fontVariant: ["tabular-nums"] },
  dur: { fontSize: 11, color: colors.textSecondary },
  track: {
    height: 5,
    borderRadius: 99,
    backgroundColor: colors.surfaceMuted,
    marginTop: spacing.xs + 2,
    overflow: "hidden",
  },
  fill: { position: "absolute", top: 0, bottom: 0, borderRadius: 99, backgroundColor: colors.primary },
  tag: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 99,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 4,
  },
  tagLabel: { fontSize: 9, letterSpacing: 1, color: colors.textSecondary, fontWeight: "600" },
});
