import { Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBadge } from "@/components/ui";
import { useOfflineQueueStore, type OfflineQueueItem } from "@/store/offlineQueueStore";
import { cancelOfflineItem, dismissOfflineItem, syncOfflineQueue } from "@/services/offlineQueue";
import { useSettingsStore } from "@/store/settingsStore";
import { colors, radius, spacing, typography } from "@/theme";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

const STATUS_BADGE: Record<OfflineQueueItem["status"], { label: string; tone: "warning" | "danger" | "neutral" }> = {
  pending: { label: "Pending", tone: "warning" },
  syncing: { label: "Sending…", tone: "neutral" },
  failed: { label: "Not recorded", tone: "danger" },
  already_recorded: { label: "Already recorded", tone: "neutral" },
};

/**
 * Check-ins/outs saved on the phone while offline (see
 * services/offlineQueue.ts) that haven't been recorded yet, plus the outcome
 * of the last send. Renders nothing when there's nothing to say. Pending
 * items can be cancelled; failed / already-recorded ones are kept (with the
 * server's reason) until dismissed.
 */
export function PendingSyncCard({ employeeCode }: { employeeCode: string | undefined }) {
  const allItems = useOfflineQueueStore((s) => s.items);
  const notice = useOfflineQueueStore((s) => s.notice);
  const setNotice = useOfflineQueueStore((s) => s.setNotice);
  const liveLocationEnabled = useSettingsStore((s) => s.liveLocationEnabled);
  const items = allItems.filter((i) => i.employeeCode === employeeCode);

  if (items.length === 0 && !notice) return null;
  const hasPending = items.some((i) => i.status === "pending");

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.cardLabel}>PENDING SYNC</Text>
        {hasPending ? (
          <Pressable onPress={() => void syncOfflineQueue()} hitSlop={8}>
            <Text style={styles.link}>Send now</Text>
          </Pressable>
        ) : null}
      </View>

      {notice ? (
        <View style={styles.noticeRow}>
          <Text style={[styles.noticeText, notice.tone === "warning" && styles.noticeTextWarn]}>{notice.message}</Text>
          <Pressable onPress={() => setNotice(null)} hitSlop={8}>
            <Text style={styles.link}>OK</Text>
          </Pressable>
        </View>
      ) : null}

      {items.map((item) => {
        const badge = STATUS_BADGE[item.status];
        return (
          <View key={item.clientId} style={styles.itemRow}>
            <View style={styles.itemText}>
              <Text style={styles.itemTitle}>
                {item.action === "CHECK_IN" ? "Check-in" : "Check-out"} · {formatTime(item.capturedAt)}
              </Text>
              {item.status === "pending" || item.status === "syncing" ? (
                <Text style={styles.itemMeta}>
                  Saved on this phone. Sent automatically when you're back online.
                  {item.pinUnverified ? " Your PIN is checked when it's sent." : ""}
                </Text>
              ) : item.errorMessage ? (
                <Text style={[styles.itemMeta, item.status === "failed" && styles.itemMetaError]}>
                  {item.errorMessage}
                </Text>
              ) : null}
            </View>
            <View style={styles.itemSide}>
              <StatusBadge label={badge.label} tone={badge.tone} />
              {item.status === "pending" ? (
                <Pressable
                  onPress={() => void cancelOfflineItem(item.clientId, { liveLocationEnabled })}
                  hitSlop={8}
                >
                  <Text style={styles.sideLink}>Cancel</Text>
                </Pressable>
              ) : item.status === "failed" || item.status === "already_recorded" ? (
                <Pressable onPress={() => void dismissOfflineItem(item.clientId)} hitSlop={8}>
                  <Text style={styles.sideLink}>Dismiss</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardLabel: { fontSize: 9, letterSpacing: 1.5, color: colors.textMuted, fontWeight: "600" },
  link: { ...typography.bodyStrong, color: colors.primary, fontSize: 13 },
  noticeRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  noticeText: { ...typography.caption, color: colors.success, flex: 1 },
  noticeTextWarn: { color: colors.warning },
  itemRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  itemText: { flex: 1 },
  itemTitle: { ...typography.bodyStrong, color: colors.textPrimary, fontSize: 14 },
  itemMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  itemMetaError: { color: colors.danger },
  itemSide: { alignItems: "flex-end", gap: spacing.xs },
  sideLink: { ...typography.bodyStrong, color: colors.textSecondary, fontSize: 12.5 },
});
