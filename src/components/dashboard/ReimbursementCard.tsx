import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Kicker, Pill } from "@/components/ui";
import { useReimbursements } from "@/hooks";
import type { DashboardStackParamList } from "@/navigation/types";
import { colors, fontFamilies, radius, spacing, typography } from "@/theme";
import { formatKm, formatRate, formatRupees } from "@/utils/reimbursement";

type Nav = NativeStackNavigationProp<DashboardStackParamList>;

/**
 * Home's travel-reimbursement summary for FIELD employees: this month's
 * total (approved + in-review estimate), today's running estimate and an
 * approved / in-review split. Renders nothing for anyone else, while the
 * first load is in flight, or if it failed — it's a secondary card, so it
 * stays out of the way rather than showing an error on Home. Tapping it
 * opens the Dashboard stack's `Reimbursement` screen.
 */
export function ReimbursementCard() {
  const navigation = useNavigation<Nav>();
  const { data } = useReimbursements();
  if (!data || !data.enabled) return null;

  const rate = data.ratePerKm;
  const { totals, today } = data;
  const hasRate = rate !== null;
  const splitTotal = totals.approvedAmount + totals.inReviewAmount;

  return (
    <Pressable
      onPress={() => navigation.navigate("Reimbursement")}
      accessibilityRole="button"
      accessibilityLabel="Reimbursement details"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
        <View style={styles.header}>
          <Kicker style={styles.kicker}>Reimbursement</Kicker>
          {hasRate ? (
            <Pill label={formatRate(rate)} variant="ink" trailingIcon="chevronRight" />
          ) : (
            <Pill label="Rate not set" variant="muted" trailingIcon="chevronRight" />
          )}
        </View>

        <View style={styles.figures}>
          <View style={styles.flex}>
            <Text style={styles.sub}>THIS MONTH</Text>
            <Text style={styles.total} numberOfLines={1} adjustsFontSizeToFit>
              {hasRate ? formatRupees(totals.totalAmount) : formatKm(totals.distanceKm)}
            </Text>
          </View>
          <View style={styles.todayCol}>
            <Text style={styles.sub}>{hasRate ? "TODAY ≈" : "TODAY"}</Text>
            <Text style={styles.today}>
              {hasRate && today.estimatedAmount !== null ? formatRupees(today.estimatedAmount) : formatKm(today.distanceKm)}
            </Text>
          </View>
        </View>

        {hasRate ? (
          <>
            <View style={styles.split}>
              {splitTotal > 0 ? (
                <>
                  <View style={{ flex: totals.approvedAmount, backgroundColor: colors.ink }} />
                  <View style={{ flex: totals.inReviewAmount, backgroundColor: colors.primary }} />
                </>
              ) : null}
            </View>
            <View style={styles.legend}>
              <LegendItem color={colors.ink} label={`Approved ${formatRupees(totals.approvedAmount)}`} />
              <LegendItem color={colors.primary} label={`In review ${formatRupees(totals.inReviewAmount)}`} />
            </View>
          </>
        ) : (
          <Text style={styles.noRate}>Your admin hasn't set a rate per km yet, so only distance is shown.</Text>
        )}
    </Pressable>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.85 },
  card: {
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm + 2 },
  kicker: { marginBottom: 0 },
  figures: { flexDirection: "row", alignItems: "flex-end", gap: spacing.md },
  flex: { flex: 1 },
  sub: { ...typography.statLabel, color: colors.textSecondary },
  total: { ...typography.display, fontSize: 34, letterSpacing: -1, color: colors.ink },
  todayCol: { alignItems: "flex-end" },
  today: { ...typography.number, fontSize: 20, color: colors.ink },
  split: {
    flexDirection: "row",
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: colors.surfaceMuted,
    marginTop: spacing.sm + 2,
    marginBottom: spacing.sm,
  },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 11, color: colors.textSecondary, fontFamily: fontFamilies.medium },
  noRate: { ...typography.caption, fontSize: 12, color: colors.textSecondary, marginTop: spacing.sm },
});
