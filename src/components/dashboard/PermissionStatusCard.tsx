import { StyleSheet, Text, View } from "react-native";
import { Card, IconTile, ListRow, StatusBadge } from "@/components/ui";
import { colors, spacing, typography } from "@/theme";
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

interface PermissionStatusCardProps {
  permission: TimedPermission;
  /** Render as a ListRow (Home's "Today" card) instead of a standalone card. */
  asRow?: boolean;
  /** Hairline above the row (every row but the first in a card). */
  divider?: boolean;
}

/** Mirrors PresenceCard/LateNoticeCard's warning-tone convention — a self-
 * declared permission window is informational, not an error, but shares the
 * same "this affects your work time" visual weight as those. A declined
 * request gets the danger tone instead, since it's a rejection, not a
 * neutral/in-progress state. */
export function PermissionStatusCard({ permission, asRow, divider }: PermissionStatusCardProps) {
  const isActive = permission.status === "active";
  const isRejected = permission.status === "rejected";
  const tone = isRejected ? "danger" : "warning";
  const badge = (
    <StatusBadge label={STATUS_LABEL[permission.status]} tone={isActive ? "ink" : tone} />
  );
  const range = `${formatTime(permission.startTime)} – ${formatTime(permission.endTime)}`;

  if (asRow) {
    return <ListRow icon="clock" title="Timed permission" subtitle={range} trailing={badge} divider={divider} />;
  }

  return (
    <Card tone={tone} style={styles.card}>
      <View style={styles.row}>
        <IconTile icon="clock" tone={tone} />
        <View style={styles.text}>
          <Text style={[styles.headline, isRejected && styles.headlineRejected]}>Timed permission</Text>
          <Text style={styles.subline}>{range}</Text>
        </View>
        {badge}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: spacing.sm + 4, padding: spacing.sm + 6 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 4 },
  text: { flex: 1, minWidth: 0 },
  headline: { ...typography.bodyStrong, fontSize: 14.5, color: colors.warning },
  headlineRejected: { color: colors.danger },
  subline: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
});
