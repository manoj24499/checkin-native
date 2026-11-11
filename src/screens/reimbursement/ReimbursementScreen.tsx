import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  Card,
  EmptyState,
  ErrorView,
  GradientFill,
  IconButton,
  Kicker,
  LoadingView,
  Rise,
  Screen,
  ScreenTitle,
  loopEasing,
  useLoop,
  useReducedMotion,
} from "@/components/ui";
import { renderIcon } from "@/components/ui/Icon";
import { useReimbursements } from "@/hooks";
import type { ReimbursementDay } from "@/types";
import { getErrorMessage } from "@/utils/errors";
import { formatDayKey, formatKm, formatMonthKey, formatRate, formatRupees, shiftMonthKey } from "@/utils/reimbursement";
import { colors, fontFamilies, spacing, typography } from "@/theme";

/** Split-bar segment colours (Reimbursement.dc.html). */
const APPROVED_BAR = colors.liveDot; // #4ADE80
const REVIEW_BAR = colors.primarySoftText; // #FFB067
const FILL_EASING = Easing.bezier(0.3, 0.7, 0.2, 1);

/**
 * Dashboard-stack route `Reimbursement` (FIELD employees only): one IST
 * month of travel reimbursement — the month total in the summary card, today's
 * running estimate, a month picker and the per-day list (approved days are
 * final, in-review days are estimates until an admin saves them).
 */
export function ReimbursementScreen() {
  const navigation = useNavigation();
  // undefined = the current month (the server decides "current" in IST).
  const [month, setMonth] = useState<string | undefined>(undefined);
  const query = useReimbursements(month);
  const data = query.data;

  const header = (
    <Rise style={styles.header}>
      <IconButton icon="back" onPress={() => navigation.goBack()} accessibilityLabel="Back" />
      <View accessibilityRole="header">
        <Kicker>Travel</Kicker>
        <ScreenTitle style={styles.title}>Reimbursement</ScreenTitle>
      </View>
    </Rise>
  );

  if (query.isLoading) {
    return (
      <Screen glow="topRight" contentStyle={styles.content}>
        {header}
        <LoadingView label="Loading reimbursement…" />
      </Screen>
    );
  }
  if (query.isError && !data) {
    return (
      <Screen glow="topRight" contentStyle={styles.content}>
        {header}
        <ErrorView message={getErrorMessage(query.error)} onRetry={() => query.refetch()} />
      </Screen>
    );
  }
  if (!data || !data.enabled) {
    return (
      <Screen glow="topRight" contentStyle={styles.content}>
        {header}
        <EmptyState
          icon="car"
          title="Not available"
          message="Travel reimbursement is only for employees who work in the field."
        />
      </Screen>
    );
  }

  const rate = data.ratePerKm;
  const { totals, today, days } = data;
  const currentMonth = data.todayKey.slice(0, 7);
  const shownMonth = month ?? currentMonth;
  const atCurrentMonth = shownMonth >= currentMonth;
  // keepPreviousData: while another month loads, the last one stays visible (dimmed).
  const switching = query.isPlaceholderData;
  const approvedDays = days.filter((d) => d.status === "APPROVED").length;
  const inReviewDays = days.length - approvedDays;
  const splitTotal = totals.approvedAmount + totals.inReviewAmount;
  const showToday = !switching && (today.active || today.distanceKm > 0);
  const dayCount = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;

  const goToMonth = (delta: number) => {
    const next = shiftMonthKey(shownMonth, delta);
    setMonth(next >= currentMonth ? undefined : next);
  };

  return (
    <Screen
      scroll
      glow="topRight"
      contentStyle={styles.content}
      refreshing={query.isRefetching && !switching}
      onRefresh={() => query.refetch()}
    >
      {header}

      <Rise delay={100}>
        <Card style={styles.summary}>
          <View style={styles.monthRow}>
            <MonthButton direction="prev" label="Previous month" onPress={() => goToMonth(-1)} />
            <View style={styles.monthLabelWrap}>
              <Text style={styles.monthLabel}>{formatMonthKey(shownMonth)}</Text>
              {switching ? <ActivityIndicator size="small" color={colors.accentText} /> : null}
            </View>
            <MonthButton
              direction="next"
              label="Next month"
              disabled={atCurrentMonth}
              onPress={() => goToMonth(1)}
            />
          </View>
          <View style={[styles.summaryBody, switching && styles.dimmed]}>
            <Text style={styles.bigValue} numberOfLines={1} adjustsFontSizeToFit>
              {rate !== null ? formatRupees(totals.totalAmount) : formatKm(totals.distanceKm)}
            </Text>
            <Text style={styles.summaryMeta}>
              {rate !== null
                ? `${formatKm(totals.distanceKm)} · ${dayCount(days.length)} · ${formatRate(rate, true)}`
                : "Rate not set yet"}
            </Text>
          </View>
          {rate !== null ? (
            <View style={[styles.split, switching && styles.dimmed]}>
              {splitTotal > 0 ? (
                <>
                  <SplitSegment
                    key={`a-${shownMonth}`}
                    pct={(totals.approvedAmount / splitTotal) * 100}
                    color={APPROVED_BAR}
                    delay={300}
                  />
                  <SplitSegment
                    key={`r-${shownMonth}`}
                    pct={(totals.inReviewAmount / splitTotal) * 100}
                    color={REVIEW_BAR}
                    delay={500}
                  />
                </>
              ) : null}
            </View>
          ) : null}
          <View style={[styles.mini, switching && styles.dimmed]}>
            <MiniStat
              tone="success"
              label="APPROVED"
              value={rate !== null ? formatRupees(totals.approvedAmount) : dayCount(approvedDays)}
            />
            <MiniStat
              tone="warning"
              label="IN REVIEW"
              value={rate !== null ? formatRupees(totals.inReviewAmount) : dayCount(inReviewDays)}
            />
          </View>
        </Card>
      </Rise>

      {showToday ? (
        <Rise delay={200}>
          <Card size="sm" style={styles.todayCard}>
            <PulseTile />
            <View style={styles.flex}>
              <Text style={styles.todayTitle}>Today so far · estimate</Text>
              <Text style={styles.todayText}>Counted once the day is over</Text>
            </View>
            <View style={styles.dayRight}>
              {rate !== null && today.estimatedAmount !== null ? (
                <Text style={styles.todayAmount}>≈ {formatRupees(today.estimatedAmount)}</Text>
              ) : null}
              <Text style={styles.todayKm}>{formatKm(today.distanceKm)}</Text>
            </View>
          </Card>
        </Rise>
      ) : null}

      <Rise delay={260} style={styles.listHeader}>
        <Kicker style={{ marginBottom: 0 }}>Days</Kicker>
        <Text style={styles.listHint}>Newest first</Text>
      </Rise>

      <Rise delay={300}>
        {days.length === 0 ? (
          <Card size="sm" style={switching ? styles.dimmed : undefined}>
            <EmptyState
              icon="car"
              title="No field days this month yet"
              message="Days with tracked travel show up here once the day is over."
            />
          </Card>
        ) : (
          <Card size="sm" style={[styles.listCard, switching && styles.dimmed]}>
            {days.map((day, i) => (
              <DayRow key={day.date} day={day} last={i === days.length - 1} />
            ))}
          </Card>
        )}
      </Rise>

      {query.isError ? (
        <Text style={styles.footnoteError}>Couldn't refresh: {getErrorMessage(query.error)}</Text>
      ) : null}
      <Text style={styles.footnote}>Distance comes from your tracked route. Amounts are final once approved.</Text>
    </Screen>
  );
}

/** 34px month-nav circle (8% ink fill; the disabled "next" is transparent at 40%). */
function MonthButton({
  direction,
  label,
  onPress,
  disabled,
}: {
  direction: "prev" | "next";
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [styles.monthBtn, disabled && styles.monthBtnDisabled, pressed && { opacity: 0.7 }]}
    >
      {renderIcon(direction === "prev" ? "chevronLeft" : "chevronRight", 15, colors.ink, 2)}
    </Pressable>
  );
}

/** One coloured share of the approved / in-review split bar, growing in from the left (mockup `fill`). */
function SplitSegment({ pct, color, delay }: { pct: number; color: string; delay: number }) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) {
      v.setValue(1);
      return;
    }
    const a = Animated.timing(v, { toValue: 1, duration: 1400, delay, easing: FILL_EASING, useNativeDriver: true });
    a.start();
    return () => a.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);
  if (pct <= 0) return null;
  return (
    <Animated.View
      style={{
        width: `${pct}%`,
        height: "100%",
        backgroundColor: color,
        transformOrigin: "left",
        transform: [{ scaleX: v }],
      }}
    />
  );
}

/** 40px rounded gradient tile with a car glyph and a pulsing halo behind it (mockup `pulse`, 2.4s). */
function PulseTile() {
  const t = useLoop({ duration: 2400, easing: loopEasing.easeOut, restValue: 1 });
  return (
    <View style={styles.tileBox}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.tileHalo,
          {
            opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
            transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }],
          },
        ]}
      />
      <GradientFill style={styles.tile}>{renderIcon("car", 20, colors.onOrange, 2)}</GradientFill>
    </View>
  );
}

function MiniStat({ value, label, tone }: { value: string; label: string; tone: "success" | "warning" }) {
  const ok = tone === "success";
  return (
    <View style={[styles.miniItem, { backgroundColor: ok ? "rgba(74,222,128,0.10)" : "rgba(255,176,60,0.10)" }]}>
      <Text style={[styles.miniLabel, { color: ok ? colors.success : colors.warning }]}>{label}</Text>
      <Text style={styles.miniValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

function DayRow({ day, last }: { day: ReimbursementDay; last: boolean }) {
  const approved = day.status === "APPROVED";
  return (
    <View style={[styles.dayRow, !last && styles.dayDivider]}>
      <View style={styles.flex}>
        <Text style={styles.dayTitle}>{formatDayKey(day.date)}</Text>
        <Text style={styles.daySub}>
          {day.ratePerKm !== null
            ? `${formatKm(day.distanceKm)} · ${formatRate(day.ratePerKm, true)}`
            : formatKm(day.distanceKm)}
        </Text>
        {day.note ? <Text style={styles.dayNote}>“{day.note}”</Text> : null}
      </View>
      <View style={styles.dayRight}>
        {day.amount !== null ? (
          <Text style={styles.dayAmount}>
            {day.estimated ? "≈ " : ""}
            {formatRupees(day.amount)}
          </Text>
        ) : null}
        <Text style={[styles.dayStatus, { color: approved ? colors.success : colors.warning }]}>
          {approved ? "Approved" : "In review"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.gutter, paddingTop: 12, gap: 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { fontSize: 26, lineHeight: 32 },
  flex: { flex: 1, minWidth: 0 },
  dimmed: { opacity: 0.5 },
  summary: { borderRadius: 26, padding: 18, gap: 12 },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  monthBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.iconButtonBg,
    alignItems: "center",
    justifyContent: "center",
  },
  monthBtnDisabled: { backgroundColor: "transparent", opacity: 0.4 },
  monthLabelWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  monthLabel: { fontSize: 14, fontWeight: "600", fontFamily: fontFamilies.semiBold, color: colors.ink },
  summaryBody: { gap: 0 },
  bigValue: { ...typography.display, fontSize: 46, lineHeight: 52, color: colors.ink },
  summaryMeta: { fontSize: 13, fontFamily: fontFamilies.regular, color: colors.textSecondary, fontVariant: ["tabular-nums"] },
  split: {
    flexDirection: "row",
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
    backgroundColor: "rgba(23,19,15,0.10)",
  },
  mini: { flexDirection: "row", gap: 10 },
  miniItem: { flex: 1, minWidth: 0, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 },
  miniLabel: { ...typography.statLabel },
  miniValue: { ...typography.number, fontSize: 18, color: colors.ink, marginTop: 3 },
  todayCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderColor: "rgba(255,154,61,0.4)",
  },
  tileBox: { width: 40, height: 40 },
  tileHalo: { position: "absolute", left: 0, top: 0, width: 40, height: 40, borderRadius: 14, backgroundColor: colors.pulse },
  tile: { width: 40, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  todayTitle: { fontSize: 14, fontWeight: "600", fontFamily: fontFamilies.semiBold, color: colors.ink },
  todayText: { fontSize: 12, fontFamily: fontFamilies.regular, color: colors.textSecondary },
  todayAmount: { ...typography.number, fontSize: 16, color: colors.ink },
  todayKm: { fontSize: 11, fontFamily: fontFamilies.regular, color: colors.textSecondary, fontVariant: ["tabular-nums"] },
  listHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  listHint: { fontSize: 12, fontFamily: fontFamilies.regular, color: colors.textSecondary },
  listCard: { paddingVertical: 2, paddingHorizontal: 0 },
  dayRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  dayDivider: { borderBottomWidth: 1, borderBottomColor: colors.hairlineSoft },
  dayTitle: { fontSize: 14, fontWeight: "600", fontFamily: fontFamilies.semiBold, color: colors.ink, marginBottom: 2 },
  daySub: { fontSize: 12, fontFamily: fontFamilies.regular, color: colors.textSecondary, fontVariant: ["tabular-nums"] },
  dayRight: { alignItems: "flex-end" },
  dayAmount: { ...typography.number, fontSize: 16, color: colors.ink },
  dayStatus: { fontSize: 11, fontWeight: "600", fontFamily: fontFamilies.semiBold, marginTop: 2 },
  dayNote: { fontSize: 12, fontStyle: "italic", fontFamily: fontFamilies.regular, color: colors.textSecondary, marginTop: 3 },
  footnoteError: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: fontFamilies.regular,
    color: colors.danger,
    textAlign: "center",
    paddingHorizontal: 12,
  },
  footnote: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: fontFamilies.regular,
    color: colors.textSecondary,
    textAlign: "center",
    paddingHorizontal: 12,
  },
});
