import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing, typography } from "@/theme";
import type { TimedPermission } from "@/types";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

const STATUS_LABEL: Record<TimedPermission["status"], string> = {
  pending: "Pending approval",
  rejected: "Declined",
  scheduled: "Scheduled",
  active: "Active",
  resolved: "Resolved",
};

/** Mirrors PresenceCard/LateNoticeCard's warning-tone convention — a self-
 * declared permission window is informational, not an error, but shares the
 * same "this affects your work time" visual weight as those. A declined
 * request gets the danger tone instead, since it's a rejection, not a
 * neutral/in-progress state. */
export function PermissionStatusCard({ permission }: { permission: TimedPermission }) {
  const isActive = permission.status === "active";
  const isRejected = permission.status === "rejected";
  return (
    <View style={[styles.card, isRejected && styles.cardRejected]}>
      <View style={styles.row}>
        <Text style={[styles.headline, isRejected && styles.headlineRejected]}>Timed permission</Text>
        <View style={[styles.badge, isActive && styles.badgeActive, isRejected && styles.badgeRejected]}>
          <Text
            style={[
              styles.badgeLabel,
              isActive && styles.badgeLabelActive,
              isRejected && styles.badgeLabelRejected,
            ]}
          >
            {STATUS_LABEL[permission.status]}
          </Text>
        </View>
      </View>
      <Text style={styles.subline}>
        {formatTime(permission.startTime)} – {formatTime(permission.endTime)}
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
  badgeActive: { backgroundColor: colors.warning },
  badgeRejected: { backgroundColor: colors.danger },
  badgeLabel: { fontSize: 10, fontWeight: "700", color: colors.warning },
  badgeLabelActive: { color: colors.textInverse },
  badgeLabelRejected: { color: colors.textInverse },
});
