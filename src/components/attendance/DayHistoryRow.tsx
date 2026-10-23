import { StyleSheet, Text, View } from "react-native";
import { StatusBadge } from "@/components/ui";
import type { DaySummary } from "@/utils/attendanceGrouping";
import { formatDuration } from "@/utils/attendanceGrouping";
import { colors, spacing, typography } from "@/theme";

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

const DAY_MS = 24 * 60 * 60 * 1000;

interface DayHistoryRowProps {
  day: DaySummary;
  /**
   * Inside a Card: `true` draws a hairline above the row (every row but the
   * first), `false` none. Omitted (full-screen history list): a hairline
   * below every row, as before.
   */
  divider?: boolean;
}

export function DayHistoryRow({ day, divider }: DayHistoryRowProps) {
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
    <View
      style={[
        styles.row,
        divider === undefined ? styles.dividerBottom : divider ? styles.dividerTop : null,
      ]}
    >
      <View style={styles.dateCol}>
        <Text style={styles.dayNum}>{dayNum}</Text>
        <Text style={styles.dow}>{dow}</Text>
      </View>
      <View style={styles.middleCol}>
        <View style={styles.spanRow}>
          <Text style={styles.span} numberOfLines={1}>
            {span}
          </Text>
          <Text style={styles.dur}>{dur}</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { left: `${leftPct}%`, width: `${widthPct}%` }]} />
        </View>
        {day.outsideMs ? <Text style={styles.outside}>Outside: {formatDuration(day.outsideMs)}</Text> : null}
      </View>
      <StatusBadge label={method} tone="primary" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 4,
    paddingVertical: spacing.sm + 3,
  },
  dividerBottom: { borderBottomWidth: 1, borderBottomColor: colors.border },
  dividerTop: { borderTopWidth: 1, borderTopColor: colors.border },
  dateCol: { width: 36, alignItems: "center" },
  dayNum: { ...typography.number, fontSize: 17, color: colors.ink },
  dow: { fontSize: 9.5, letterSpacing: 1, color: colors.textMuted, marginTop: 2, fontWeight: "600" },
  middleCol: { flex: 1, minWidth: 0 },
  spanRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: spacing.sm },
  span: { ...typography.bodyStrong, fontSize: 13.5, color: colors.ink, fontVariant: ["tabular-nums"], flexShrink: 1 },
  dur: { ...typography.number, fontSize: 13.5, color: colors.ink },
  track: {
    height: 5,
    borderRadius: 99,
    backgroundColor: colors.surfaceMuted,
    marginTop: spacing.xs + 2,
    overflow: "hidden",
  },
  outside: { fontSize: 11, color: colors.warning, marginTop: spacing.xs },
  fill: { position: "absolute", top: 0, bottom: 0, borderRadius: 99, backgroundColor: colors.ink },
});
