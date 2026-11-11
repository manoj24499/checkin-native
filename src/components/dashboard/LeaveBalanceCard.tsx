import { Pressable, StyleSheet, Text, View } from "react-native";
import { StatBox, StatRow } from "@/components/ui";
import { useLeaveRequests } from "@/hooks";
import { colors, radius, typography } from "@/theme";

const TYPE_LABEL: Record<string, string> = { CASUAL: "Casual", SICK: "Sick", EARNED: "Earned" };

/** Compact leave-balance summary for the Home screen (Main.dc.html "Leave left this year") — the same
 * `balances` data LeaveScreen already fetches, surfaced here so the employee doesn't need to open Requests to
 * see what's left. Tapping it navigates to the full Leave view. */
export function LeaveBalanceCard({ onPress }: { onPress: () => void }) {
  const query = useLeaveRequests();
  const balances = query.data?.balances ?? [];
  const pendingCount = (query.data?.requests ?? []).filter((r) => r.status === "PENDING").length;

  if (balances.length === 0) return null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Leave balance"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.headerRow}>
        <Text style={styles.title}>Leave left this year</Text>
        <Text style={styles.link}>{pendingCount ? `${pendingCount} pending` : "Requests"}</Text>
      </View>
      <StatRow>
        {balances.map((b) => (
          <StatBox key={b.type} tone="light" label={TYPE_LABEL[b.type] ?? b.type} value={`${b.remaining} / ${b.quota}`} />
        ))}
      </StatRow>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    gap: 12,
  },
  pressed: { opacity: 0.85 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { ...typography.cardTitle, color: colors.ink },
  link: { ...typography.link, color: colors.accentText },
});
