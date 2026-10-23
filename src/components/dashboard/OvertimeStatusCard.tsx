import { StyleSheet, Text, View } from "react-native";
import { Card, ListRow, StatusBadge } from "@/components/ui";
import { colors, spacing, typography } from "@/theme";
import type { OvertimeRequest } from "@/types";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

const STATUS_LABEL: Record<OvertimeRequest["status"], string> = {
  PENDING: "Awaiting review",
  APPROVED: "Approved",
  REJECTED: "Declined",
};

const STATUS_TONE: Record<OvertimeRequest["status"], "warning" | "success" | "danger"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

interface OvertimeStatusCardProps {
  request: OvertimeRequest;
  /** Render as a ListRow (Home's "Today" card) instead of a standalone card. */
  asRow?: boolean;
  /** Hairline above the row (every row but the first in a card). */
  divider?: boolean;
}

/** Shown while an overtime request is active (see the type's own comment —
 * it already took effect the moment it was created, unlike
 * PermissionStatusCard's TimedPermission). The status badge is purely the
 * admin's after-the-fact record — even "Declined" doesn't undo the reminder
 * already governing this session; it's shown so the employee isn't
 * surprised by a decline later. */
export function OvertimeStatusCard({ request, asRow, divider }: OvertimeStatusCardProps) {
  const isRejected = request.status === "REJECTED";
  const badge = <StatusBadge label={STATUS_LABEL[request.status]} tone={STATUS_TONE[request.status]} />;
  const subline = `Until ~${formatTime(request.estimatedEndAt)} — ${request.reason}`;

  if (asRow) {
    return <ListRow icon="history" title="Overtime" subtitle={subline} trailing={badge} divider={divider} />;
  }

  return (
    <Card tone={isRejected ? "danger" : "warning"} style={styles.card}>
      <View style={styles.row}>
        <Text style={[styles.headline, isRejected && styles.headlineRejected]}>Overtime</Text>
        {badge}
      </View>
      <Text style={styles.subline}>{subline}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: spacing.sm + 4, padding: spacing.sm + 6 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  headline: { ...typography.bodyStrong, fontSize: 14.5, color: colors.warning },
  headlineRejected: { color: colors.danger },
  subline: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
});
