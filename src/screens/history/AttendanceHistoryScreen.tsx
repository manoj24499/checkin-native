import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  LoadingView,
  ErrorView,
  ScreenBackground,
  Screen,
  Card,
  Rise,
  Kicker,
  ScreenTitle,
  IconButton,
  PulseRing,
  StatusBadge,
  useReducedMotion,
} from "@/components/ui";
import { renderIcon } from "@/components/ui/Icon";
import { HybridMinutesChips } from "@/components/dashboard/HybridSegmentCard";
import { useAttendanceHistory } from "@/hooks";
import { groupAttendanceByDay, formatDuration, type DaySummary } from "@/utils/attendanceGrouping";
import { getErrorMessage } from "@/utils/errors";
import { colors, fontFamilies, motion, spacing, typography } from "@/theme";

const DOWS = ["M", "T", "W", "T", "F", "S", "S"];
/** Mockup's muted day number (weekends / future days). */
const DIM_TEXT = "#A39A91";
/** Selected-day outline + tint (History.dc.html). */
const SEL_OUTLINE = "#FF9A3D";
const SEL_FILL = "rgba(255,154,61,0.12)";

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** 36px month-nav circle (8% ink fill; disabled = 4% fill at 40% opacity). */
function MonthButton({
  onPress,
  label,
  disabled,
  direction,
}: {
  onPress: () => void;
  label: string;
  disabled?: boolean;
  direction: "prev" | "next";
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.monthBtn,
        disabled && styles.monthBtnDisabled,
        pressed && { opacity: 0.7 },
      ]}
    >
      {renderIcon(direction === "prev" ? "chevronLeft" : "chevronRight", 16, colors.ink, 2)}
    </Pressable>
  );
}

/** Calendar cell with the mockup's `pop` entrance (scale .4 -> 1 + fade, .4s, staggered per day). */
function PopCell({ delay, children }: { delay: number; children: React.ReactNode }) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) {
      v.setValue(1);
      return;
    }
    const a = Animated.timing(v, {
      toValue: 1,
      duration: 400,
      delay,
      easing: motion.riseEasing,
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
    // Entrance only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);
  return (
    <Animated.View
      style={[
        styles.cellSlot,
        { opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

function DetailRow({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <View style={[styles.rw, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.rwLabel}>{label}</Text>
      {typeof children === "string" ? <Text style={styles.rwValue}>{children}</Text> : children}
    </View>
  );
}

export function AttendanceHistoryScreen() {
  const navigation = useNavigation();
  const query = useAttendanceHistory();
  const [offset, setOffset] = useState(0);
  const [sel, setSel] = useState<number | null>(null);

  const days = useMemo(() => {
    const records = query.data?.pages.flatMap((page) => page.records) ?? [];
    return groupAttendanceByDay(records);
  }, [query.data]);

  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const y = first.getFullYear();
  const m = first.getMonth();
  const len = new Date(y, m + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const isCur = offset === 0;

  // Page in older records when browsing back past what has loaded so far.
  const oldest = days.length ? days[days.length - 1].date : null;
  useEffect(() => {
    if (oldest && oldest > first && query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
  }, [oldest, offset, query.hasNextPage, query.isFetchingNextPage]); // eslint-disable-line react-hooks/exhaustive-deps

  const byDay = useMemo(() => {
    const map = new Map<number, DaySummary>();
    for (const d of days) {
      if (d.date.getFullYear() === y && d.date.getMonth() === m) map.set(d.date.getDate(), d);
    }
    return map;
  }, [days, y, m]);

  if (query.isLoading) return <LoadingView label="Loading history…" fullScreen />;
  if (query.isError) {
    return (
      <ScreenBackground>
        <ErrorView message={getErrorMessage(query.error)} onRetry={() => query.refetch()} />
      </ScreenBackground>
    );
  }

  const selDay = sel ?? (isCur ? today.getDate() : len);
  const summary = byDay.get(selDay);
  const selDate = new Date(y, m, selDay);
  const selIsToday = sameDay(selDate, today);
  const selFuture = selDate > today && !selIsToday;
  const selWeekend = selDate.getDay() === 0 || selDate.getDay() === 6;

  const present = [...byDay.values()].filter((d) => d.checkIn);
  const totalMs = present.reduce((a, d) => a + (d.durationMs ?? 0), 0);
  const avgStartMin = present.length
    ? Math.round(
        present.reduce((a, d) => {
          const t = new Date(d.checkIn!.timestamp);
          return a + t.getHours() * 60 + t.getMinutes();
        }, 0) / present.length,
      )
    : null;
  const avgIn =
    avgStartMin === null
      ? "—"
      : `${String(Math.floor(avgStartMin / 60)).padStart(2, "0")}:${String(avgStartMin % 60).padStart(2, "0")}`;
  const stats = [
    { label: "Days", value: String(present.length) },
    { label: "Hours", value: `${Math.round(totalMs / 3_600_000)}h` },
    { label: "Avg in", value: avgIn },
    { label: "Outside", value: formatDuration(present.reduce((a, d) => a + (d.outsideMs ?? 0), 0)) },
  ];

  const cells: (number | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: len }, (_, i) => i + 1),
  ];
  while (cells.length % 7) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  let pill: [string, "primary" | "success" | "neutral"];
  if (summary?.checkIn && !summary.checkOut && selIsToday) pill = ["In progress", "primary"];
  else if (summary?.checkIn) pill = ["Present", "success"];
  else if (selFuture) pill = ["Upcoming", "neutral"];
  else if (selWeekend) pill = ["Weekend", "neutral"];
  else pill = ["No record", "neutral"];

  const emptyNote = selWeekend
    ? "Not a working day."
    : selFuture
      ? "Nothing recorded yet."
      : "No check-in recorded for this day.";

  const monthKey = `${y}-${m}`;
  const hasHybrid = !!summary?.hybridSplit;
  const hasOutside = !!summary?.outsideMs;

  return (
    <Screen
      scroll
      glow="topRight"
      refreshing={query.isRefetching}
      onRefresh={() => query.refetch()}
      contentStyle={styles.content}
    >
      <Rise style={styles.header}>
        {navigation.canGoBack() ? (
          <IconButton icon="back" onPress={() => navigation.goBack()} accessibilityLabel="Back" />
        ) : null}
        <View accessibilityRole="header">
          <Kicker>Attendance</Kicker>
          <ScreenTitle style={styles.title}>History</ScreenTitle>
        </View>
      </Rise>

      <Rise delay={100}>
        <Card style={styles.monthCard}>
          <View style={styles.monthRow}>
            <MonthButton
              direction="prev"
              label="Previous month"
              onPress={() => {
                setOffset(offset - 1);
                setSel(null);
              }}
            />
            <Text style={styles.month}>{first.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</Text>
            <MonthButton
              direction="next"
              label="Next month"
              disabled={isCur}
              onPress={() => {
                if (isCur) return;
                setOffset(offset + 1);
                setSel(null);
              }}
            />
          </View>
          <View style={styles.statsRow}>
            {stats.map((s) => (
              <View key={s.label} style={styles.stat}>
                <Text style={styles.statLabel}>{s.label.toUpperCase()}</Text>
                <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
                  {s.value}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      </Rise>

      <Rise delay={200}>
        <Card style={styles.calCard}>
          <View style={[styles.week, { marginBottom: 6 }]}>
            {DOWS.map((w, i) => (
              <Text key={`${w}${i}`} style={styles.dow}>
                {w}
              </Text>
            ))}
          </View>
          <View style={{ gap: 4 }}>
            {weeks.map((week, wi) => (
              <View key={`${monthKey}-w${wi}`} style={styles.week}>
                {week.map((d, di) => {
                  if (d === null) return <View key={`b${wi}-${di}`} style={styles.cellSlot} />;
                  const date = new Date(y, m, d);
                  const isToday = sameDay(date, today);
                  const rec = byDay.get(d);
                  const s = d === selDay;
                  const dim = (date > today && !isToday) || date.getDay() === 0 || date.getDay() === 6;
                  return (
                    <PopCell key={`${monthKey}-${d}`} delay={300 + d * 15}>
                      <Pressable
                        onPress={() => setSel(d)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: s }}
                        accessibilityLabel={date.toLocaleDateString("en-GB", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                        })}
                        style={({ pressed }) => [styles.cell, s && styles.cellSel, pressed && { opacity: 0.7 }]}
                      >
                        <Text
                          style={[
                            styles.cellNum,
                            dim && { color: DIM_TEXT },
                            isToday && { fontFamily: fontFamilies.bold, fontWeight: "700" },
                          ]}
                        >
                          {d}
                        </Text>
                        <View style={styles.dotBox}>
                          {isToday ? (
                            <PulseRing size={5} color={colors.pulse} scaleTo={3.4} opacityFrom={0.5} duration={2000} />
                          ) : null}
                          <View
                            style={[
                              styles.dot,
                              {
                                backgroundColor: isToday
                                  ? colors.pulse
                                  : rec?.checkIn
                                    ? colors.liveDot
                                    : "transparent",
                              },
                            ]}
                          />
                        </View>
                      </Pressable>
                    </PopCell>
                  );
                })}
              </View>
            ))}
          </View>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.liveDot }]} />
              <Text style={styles.legendText}>Present</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.pulse }]} />
              <Text style={styles.legendText}>Today</Text>
            </View>
          </View>
        </Card>
      </Rise>

      <Rise delay={300}>
        <Card style={styles.dayCard}>
          <View style={styles.dayHead}>
            <Text style={styles.dayTitle}>
              {selDate.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
            </Text>
            <StatusBadge label={pill[0]} tone={pill[1]} />
          </View>
          {summary?.checkIn ? (
            <View>
              <DetailRow label="Checked in">{timeOf(summary.checkIn.timestamp)}</DetailRow>
              <DetailRow label="Checked out">
                {summary.checkOut ? (
                  timeOf(summary.checkOut.timestamp)
                ) : (
                  <Text style={[styles.rwValue, { color: colors.accentText }]}>Still in</Text>
                )}
              </DetailRow>
              <DetailRow label="Worked" last={!hasHybrid && !hasOutside}>
                {summary.durationMs !== null ? formatDuration(summary.durationMs) : "Counting…"}
              </DetailRow>
              {summary.hybridSplit ? (
                <DetailRow label="Where" last={!hasOutside}>
                  <HybridMinutesChips
                    office={summary.hybridSplit.officeMs / 60_000}
                    home={summary.hybridSplit.homeMs / 60_000}
                    transit={summary.hybridSplit.transitMs / 60_000}
                    style={styles.hybridChips}
                  />
                </DetailRow>
              ) : null}
              {summary.outsideMs ? (
                <DetailRow label="Outside" last>
                  {formatDuration(summary.outsideMs)}
                </DetailRow>
              ) : null}
            </View>
          ) : (
            <Text style={styles.empty}>{emptyNote}</Text>
          )}
        </Card>
      </Rise>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.gutter, paddingTop: 12, gap: 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontSize: 26, lineHeight: 32 },
  monthCard: { paddingVertical: 14, paddingHorizontal: 16, gap: 12 },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  monthBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.iconButtonBg,
    alignItems: "center",
    justifyContent: "center",
  },
  monthBtnDisabled: { backgroundColor: "rgba(23,19,15,0.04)", opacity: 0.4 },
  month: { ...typography.section, color: colors.ink },
  statsRow: { flexDirection: "row" },
  stat: { flex: 1, minWidth: 0, paddingRight: 4 },
  statLabel: { ...typography.statLabel, color: colors.textSecondary },
  statValue: { ...typography.number, fontSize: 18, color: colors.ink, marginTop: 4 },
  calCard: { padding: 12 },
  week: { flexDirection: "row", gap: 4 },
  dow: {
    flex: 1,
    textAlign: "center",
    fontSize: 10,
    fontWeight: "600",
    fontFamily: fontFamilies.semiBold,
    color: colors.textSecondary,
  },
  cellSlot: { flex: 1, minWidth: 0 },
  cell: { height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cellSel: { borderWidth: 2, borderColor: SEL_OUTLINE, backgroundColor: SEL_FILL },
  cellNum: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "500",
    fontFamily: fontFamilies.medium,
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  dotBox: { width: 5, height: 5, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  legend: { flexDirection: "row", gap: 16, marginTop: 10 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { fontSize: 11, fontFamily: fontFamilies.regular, color: colors.textSecondary },
  dayCard: { paddingVertical: 14, paddingHorizontal: 16 },
  dayHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  dayTitle: { ...typography.section, color: colors.ink },
  rw: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairlineSoft,
  },
  rwLabel: { fontSize: 14, fontFamily: fontFamilies.regular, color: colors.textSecondary },
  rwValue: { fontSize: 14, fontFamily: fontFamilies.regular, color: colors.ink, fontVariant: ["tabular-nums"] },
  hybridChips: { flexShrink: 1, justifyContent: "flex-end" },
  empty: { paddingTop: 8, fontSize: 14, lineHeight: 20, fontFamily: fontFamilies.regular, color: colors.textSecondary },
});
