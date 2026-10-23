import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "@/components/ui";
import { useLeaveRequests } from "@/hooks";
import { colors, radius, shadows, spacing, typography } from "@/theme";

const TYPE_LABEL: Record<string, string> = { CASUAL: "CASUAL", SICK: "SICK", EARNED: "EARNED" };

/** Compact leave-balance summary for the Home screen — the same `balances`
 * data LeaveScreen already fetches, just surfaced here too so the employee
 * doesn't need to open Requests to see what's left. Tapping it navigates to
 * the full Leave view. */
export function LeaveBalanceCard({ onPress }: { onPress: () => void }) {
  const query = useLeaveRequests();
  const balances = query.data?.balances ?? [];
  const pendingCount = (query.data?.requests ?? []).filter((r) => r.status === "PENDING").length;

  if (balances.length === 0) return null;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Leave left this year</Text>
        <View style={styles.linkRow}>
          <Text style={styles.link}>{pendingCount ? `${pendingCount} pending` : "Requests"}</Text>
          <Icon name="arrow" size={13} color={colors.primaryDark} strokeWidth={2} />
        </View>
      </View>
      <View style={styles.row}>
        {balances.map((b) => (
          <View key={b.type} style={styles.cell}>
            <Text style={styles.cellLabel}>{TYPE_LABEL[b.type] ?? b.type}</Text>
            <View style={styles.valueRow}>
              <Text style={styles.cellValue}>{b.remaining}</Text>
              <Text style={styles.cellQuota}> / {b.quota}</Text>
            </View>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { width: `${b.quota > 0 ? (b.remaining / b.quota) * 100 : 0}%` },
                ]}
              />
            </View>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.sm + 4,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(14,36,16,0.06)",
    padding: spacing.md,
    ...shadows.card,
  },
  pressed: { opacity: 0.85 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { ...typography.bodyStrong, fontSize: 14, color: colors.ink },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  link: { ...typography.bodyStrong, fontSize: 12, color: colors.primaryDark },
  row: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm + 4 },
  cell: { flex: 1, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: spacing.sm + 2 },
  cellLabel: { fontSize: 9.5, letterSpacing: 1.2, color: colors.textSecondary, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  valueRow: { flexDirection: "row", alignItems: "baseline", marginTop: 3 },
  cellValue: { ...typography.number, fontSize: 22, color: colors.ink },
  cellQuota: { ...typography.caption, color: colors.textMuted, fontSize: 11 },
  track: { height: 4, borderRadius: 99, backgroundColor: colors.surface, marginTop: spacing.xs + 2, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 99, backgroundColor: colors.ink },
});
