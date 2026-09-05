import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "@/theme";
import type { OvertimeRequest } from "@/types";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

const STATUS_LABEL: Record<OvertimeRequest["status"], string> = {
  PENDING: "Awaiting review",
  APPROVED: "Approved",
  REJECTED: "Declined",
};

/** Shown while an overtime request is active (see the type's own comment —
 * it already took effect the moment it was created, unlike
 * PermissionStatusCard's TimedPermission). The status badge is purely the
 * admin's after-the-fact record — even "Declined" doesn't undo the reminder
 * already governing this session; it's shown so the employee isn't
 * surprised by a decline later. */
export function OvertimeStatusCard({ request }: { request: OvertimeRequest }) {
  const isRejected = request.status === "REJECTED";
  return (
    <View style={[styles.card, isRejected && styles.cardRejected]}>
      <View style={styles.row}>
        <Text style={[styles.headline, isRejected && styles.headlineRejected]}>Overtime</Text>
        <View style={[styles.badge, isRejected && styles.badgeRejected]}>
          <Text style={[styles.badgeLabel, isRejected && styles.badgeLabelRejected]}>
            {STATUS_LABEL[request.status]}
          </Text>
        </View>
      </View>
      <Text style={styles.subline}>
        Until ~{formatTime(request.estimatedEndAt)} — {request.reason}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(184,134,11,0.35)",
    backgroundColor: colors.warningMuted,
    padding: spacing.sm + 4,
    marginTop: spacing.md,
  },
  cardRejected: { borderColor: "rgba(179,69,63,0.35)", backgroundColor: colors.dangerMuted },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headline: { ...typography.bodyStrong, fontSize: 14.5, color: colors.warning },
  headlineRejected: { color: colors.danger },
  subline: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
  },
  badgeRejected: { backgroundColor: colors.danger },
  badgeLabel: { fontSize: 10, fontWeight: "700", color: colors.warning },
  badgeLabelRejected: { color: colors.textInverse },
});
