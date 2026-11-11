import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { GradientFill, useReducedMotion } from "@/components/ui";
import type { DaySummary } from "@/utils/attendanceGrouping";
import { computeWorkedMs, formatDuration } from "@/utils/attendanceGrouping";
import type { AttendancePauseInterval } from "@/types";
import { colors, fontFamilies, gradients, motion, typography } from "@/theme";

const BAR_AREA = 70;
const HOUR_MS = 3_600_000;
/** Full bar = 10h (anything longer is capped). Off days draw a 10% stub. */
const FULL_MS = 10 * HOUR_MS;

/**
 * Last 7 days (ending today) of worked hours (Main.dc.html "LAST 7 DAYS"): gradient bars for worked days, grey
 * stubs for days off, the selected day (today by default) in ink. Bars grow in staggered on mount. Tap a bar to
 * read that day.
 */
export function WeeklyHoursChart({
  days,
  liveToday,
}: {
  days: DaySummary[];
  /** Today's still-open session: its worked time so far stands in for today's bar (refreshed every 30 s). */
  liveToday?: { checkInAt: string; pauses: AttendancePauseInterval[]; excludeMs?: number } | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!liveToday) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [liveToday]);
  const liveMs = liveToday
    ? Math.max(
        0,
        computeWorkedMs(new Date(liveToday.checkInAt), new Date(now), liveToday.pauses) - (liveToday.excludeMs ?? 0),
      )
    : 0;
  const today = new Date();
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const match = days.find((x) => x.dateKey === key);
    return {
      key,
      label: i === 6 ? "Today" : d.toLocaleDateString(undefined, { weekday: "short" }),
      ms: match?.durationMs ?? (i === 6 ? liveMs : 0),
      isToday: i === 6,
    };
  });
  const [sel, setSel] = useState(6);

  const worked = week.filter((d) => d.ms > 0 && !d.isToday);
  const avgMs = worked.length ? worked.reduce((a, d) => a + d.ms, 0) / worked.length : 0;
  const fmt = (ms: number) => (ms <= 0 ? "Off" : formatDuration(ms));
  const selected = week[sel];

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <Text style={styles.kicker}>LAST 7 DAYS</Text>
        <Text style={styles.avg}>{`Avg ${fmt(avgMs)}`}</Text>
      </View>
      <Text style={styles.selLabel}>{`${selected.label} · ${fmt(selected.ms)}`}</Text>
      <View style={styles.chart}>
        {week.map((d, i) => (
          <Bar
            key={d.key}
            index={i}
            ms={d.ms}
            selected={i === sel}
            label={`${d.label}: ${fmt(d.ms)}`}
            onPress={() => setSel(i)}
          />
        ))}
      </View>
      <View style={styles.labels}>
        {week.map((d, i) => (
          <Text key={d.key} style={[styles.dayLabel, i === sel && styles.dayLabelSel]} numberOfLines={1}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

function Bar({
  index,
  ms,
  selected,
  label,
  onPress,
}: {
  index: number;
  ms: number;
  selected: boolean;
  label: string;
  onPress: () => void;
}) {
  const reduced = useReducedMotion();
  const grow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) {
      grow.setValue(1);
      return;
    }
    const anim = Animated.timing(grow, {
      toValue: 1,
      duration: 700,
      delay: 700 + index * 100,
      easing: motion.riseEasing,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [reduced, grow, index]);

  const off = ms <= 0;
  const h = off ? BAR_AREA * 0.1 : Math.max(BAR_AREA * 0.1, Math.round((Math.min(ms, FULL_MS) / FULL_MS) * BAR_AREA));
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={styles.col}
    >
      <Animated.View style={[styles.barWrap, { height: h, transform: [{ scaleY: grow }] }]}>
        {selected ? (
          <View style={[styles.bar, { backgroundColor: colors.ink }]} />
        ) : off ? (
          <View style={[styles.bar, { backgroundColor: "rgba(23,19,15,0.14)" }]} />
        ) : (
          <GradientFill colors={gradients.orangeVertical} direction="vertical" style={styles.bar} />
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  kicker: { ...typography.kicker, color: colors.kicker },
  avg: { fontSize: 12, fontWeight: "500", fontFamily: fontFamilies.medium, color: colors.textSecondary, fontVariant: ["tabular-nums"] },
  selLabel: { ...typography.section, color: colors.ink, fontVariant: ["tabular-nums"] },
  chart: { flexDirection: "row", gap: 9, height: BAR_AREA, alignItems: "flex-end" },
  col: { flex: 1, height: BAR_AREA, justifyContent: "flex-end" },
  barWrap: { transformOrigin: "bottom" },
  bar: { flex: 1, borderRadius: 6 },
  labels: { flexDirection: "row", gap: 9 },
  dayLabel: { flex: 1, fontSize: 10, fontFamily: fontFamilies.regular, color: colors.textSecondary, textAlign: "center" },
  dayLabelSel: { color: colors.ink, fontWeight: "600", fontFamily: fontFamilies.semiBold },
});
