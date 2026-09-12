import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLeaveRequests } from "@/hooks";
import { colors, radius, spacing, typography } from "@/theme";

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
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Leave left this year</Text>
        <Text style={styles.link}>{pendingCount ? `${pendingCount} pending` : "Requests"} →</Text>
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
  row: { flexDirection: "row", gap: spacing.md - 2, marginTop: spacing.sm + 3 },
  cell: { flex: 1 },
  cellLabel: { fontSize: 9, letterSpacing: 1.5, color: colors.textMuted, fontWeight: "600" },
  valueRow: { flexDirection: "row", alignItems: "baseline", marginTop: 3 },
  cellValue: { ...typography.bodyStrong, fontSize: 18, color: colors.textPrimary },
  cellQuota: { ...typography.caption, color: colors.textMuted, fontSize: 11 },
  track: { height: 3, borderRadius: 99, backgroundColor: colors.surfaceMuted, marginTop: spacing.xs + 2, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 99, backgroundColor: colors.primary },
});
