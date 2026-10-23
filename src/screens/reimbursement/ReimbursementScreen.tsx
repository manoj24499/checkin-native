import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  Card,
  EmptyState,
  ErrorView,
  HeroCard,
  IconButton,
  IconTile,
  Kicker,
  ListRow,
  LoadingView,
  Pill,
  Screen,
  ScreenTitle,
  StatusBadge,
} from "@/components/ui";
import { useReimbursements } from "@/hooks";
import type { ReimbursementDay } from "@/types";
import { getErrorMessage } from "@/utils/errors";
import {
  formatDayKey,
  formatKm,
  formatMonthKey,
  formatRate,
  formatRupees,
  shiftMonthKey,
} from "@/utils/reimbursement";
import { colors, radius, spacing, typography } from "@/theme";

/**
 * Dashboard-stack route `Reimbursement` (FIELD employees only): one IST
 * month of travel reimbursement — the month total in a lime hero, today's
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
    <View style={styles.header}>
      <IconButton icon="back" onPress={() => navigation.goBack()} accessibilityLabel="Back" />
      <View>
        <Kicker>Travel</Kicker>
        <ScreenTitle style={styles.title}>Reimbursement</ScreenTitle>
      </View>
    </View>
  );

  if (query.isLoading) {
    return (
      <Screen>
        {header}
        <LoadingView label="Loading reimbursement…" />
      </Screen>
    );
  }
  if (query.isError && !data) {
    return (
      <Screen>
        {header}
        <ErrorView message={getErrorMessage(query.error)} onRetry={() => query.refetch()} />
      </Screen>
    );
  }
  if (!data || !data.enabled) {
    return (
      <Screen>
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
    <Screen scroll refreshing={query.isRefetching && !switching} onRefresh={() => query.refetch()}>
      {header}

      <View style={switching ? styles.dimmed : undefined}>
        <HeroCard
          label={formatMonthKey(data.month)}
          labelRight={
            rate !== null ? (
              <Pill label={formatRate(rate)} variant="ink" />
            ) : (
              <Pill label="Rate not set yet" variant="glass" />
            )
          }
          value={rate !== null ? formatRupees(totals.totalAmount) : formatKm(totals.distanceKm)}
          valueSuffix="this month"
        >
          {rate !== null ? (
            <View style={styles.heroSplit}>
              {splitTotal > 0 ? (
                <>
                  <View style={{ flex: totals.approvedAmount, backgroundColor: colors.ink }} />
                  <View style={{ flex: totals.inReviewAmount, backgroundColor: colors.surface }} />
                </>
              ) : null}
            </View>
          ) : null}
          <View style={styles.mini}>
            <MiniStat value={formatKm(totals.distanceKm)} label="Distance" />
            <MiniStat
              value={rate !== null ? formatRupees(totals.approvedAmount) : dayCount(approvedDays)}
              label="Approved"
              dot={colors.ink}
            />
            <MiniStat
              value={rate !== null ? formatRupees(totals.inReviewAmount) : dayCount(inReviewDays)}
              label="In review"
              dot={colors.surface}
            />
          </View>
        </HeroCard>
      </View>

      {showToday ? (
        <Card tone="lime" flat style={styles.todayCard}>
          <IconTile icon="car" tone="white" />
          <View style={styles.flex}>
            <Text style={styles.todayTitle}>Today so far · estimate</Text>
            <Text style={styles.todayText}>
              {rate !== null && today.estimatedAmount !== null
                ? `${formatKm(today.distanceKm)} × ${formatRupees(rate)} = ${formatRupees(today.estimatedAmount)}. `
                : `${formatKm(today.distanceKm)} travelled so far. `}
              The final amount is confirmed by your admin.
            </Text>
          </View>
        </Card>
      ) : null}

      <View style={styles.monthRow}>
        <IconButton icon="back" onPress={() => goToMonth(-1)} accessibilityLabel="Previous month" />
        <View style={styles.monthLabelWrap}>
          <Text style={styles.monthLabel}>{formatMonthKey(shownMonth)}</Text>
          {switching ? <ActivityIndicator size="small" color={colors.ink} /> : null}
        </View>
        <IconButton
          icon="chevronRight"
          onPress={() => goToMonth(1)}
          disabled={atCurrentMonth}
          accessibilityLabel="Next month"
        />
      </View>

      {days.length === 0 ? (
        <Card style={switching ? styles.dimmed : undefined}>
          <EmptyState
            icon="car"
            title="No field days this month yet"
            message="Days with tracked travel show up here once the day is over."
          />
        </Card>
      ) : (
        <Card style={[styles.listCard, switching && styles.dimmed]}>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Days</Text>
            <Kicker style={styles.listKicker}>Newest first</Kicker>
          </View>
          {days.map((day, i) => (
            <DayRow key={day.date} day={day} divider={i > 0} />
          ))}
        </Card>
      )}

      {query.isError ? (
        <Text style={styles.footnoteError}>Couldn't refresh: {getErrorMessage(query.error)}</Text>
      ) : null}
      <Text style={styles.footnote}>Distance comes from your tracked route. Amounts are final once approved.</Text>
    </Screen>
  );
}

function MiniStat({ value, label, dot }: { value: string; label: string; dot?: string }) {
  return (
    <View style={styles.miniItem}>
      <Text style={styles.miniValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <View style={styles.miniLabelRow}>
        {dot ? <View style={[styles.miniDot, { backgroundColor: dot }]} /> : null}
        <Text style={styles.miniLabel}>{label}</Text>
      </View>
    </View>
  );
}

function DayRow({ day, divider }: { day: ReimbursementDay; divider: boolean }) {
  const approved = day.status === "APPROVED";
  const subtitle =
    day.ratePerKm !== null
      ? `${formatKm(day.distanceKm)} · ${formatRate(day.ratePerKm, true)}`
      : formatKm(day.distanceKm);
  return (
    <ListRow
      icon="car"
      title={formatDayKey(day.date)}
      subtitle={subtitle}
      divider={divider}
      trailing={
        <View style={styles.dayRight}>
          {day.amount !== null ? (
            <Text style={styles.dayAmount}>
              {day.estimated ? "≈ " : ""}
              {formatRupees(day.amount)}
            </Text>
          ) : null}
          <StatusBadge label={approved ? "Approved" : "In review"} tone={approved ? "success" : "warning"} />
        </View>
      }
    >
      {day.note ? <Text style={styles.dayNote}>“{day.note}”</Text> : null}
    </ListRow>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2, marginBottom: spacing.md },
  title: { fontSize: 22 },
  flex: { flex: 1 },
  dimmed: { opacity: 0.5 },
  heroSplit: {
    flexDirection: "row",
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "rgba(14,36,16,0.14)",
    marginTop: spacing.md,
  },
  mini: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  miniItem: {
    flex: 1,
    backgroundColor: colors.glass,
    borderRadius: radius.md,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  miniValue: { ...typography.number, fontSize: 14, color: colors.ink },
  miniLabelRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 },
  miniDot: { width: 7, height: 7, borderRadius: 4, borderWidth: 1, borderColor: "rgba(14,36,16,0.25)" },
  miniLabel: { fontSize: 10.5, color: colors.inkMuted, fontFamily: "Inter_500Medium" },
  todayCard: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4, marginTop: spacing.md },
  todayTitle: { ...typography.bodyStrong, fontSize: 14, color: colors.ink },
  todayText: { ...typography.caption, fontSize: 12.5, lineHeight: 18, color: colors.limeDeep, marginTop: 2 },
  monthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.lg,
    marginBottom: spacing.sm + 2,
  },
  monthLabelWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  monthLabel: { ...typography.section, color: colors.ink },
  listCard: { paddingVertical: spacing.sm, paddingHorizontal: 14 },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
  },
  listTitle: { ...typography.bodyStrong, fontSize: 14, color: colors.ink },
  listKicker: { marginBottom: 0 },
  dayRight: { alignItems: "flex-end", gap: 4 },
  dayAmount: { ...typography.number, fontSize: 14, color: colors.ink },
  dayNote: { ...typography.caption, fontSize: 12, fontStyle: "italic", color: colors.textSecondary, marginTop: 2 },
  footnoteError: {
    ...typography.caption,
    fontSize: 12,
    color: colors.danger,
    textAlign: "center",
    marginTop: spacing.md,
  },
  footnote: {
    ...typography.caption,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
});
