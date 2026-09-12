import { useEffect, useState } from "react";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Screen, Button, BottomSheet, StatusBadge, EmptyState, LoadingView } from "@/components/ui";
import { LeaveRequestSheet } from "./LeaveRequestSheet";
import { PermissionRequestSheet } from "./PermissionRequestSheet";
import { OvertimeRequestSheet } from "./OvertimeRequestSheet";
import {
  useLeaveRequests,
  useHolidays,
  useCancelLeaveRequest,
  useTimedPermissions,
  useOvertimeStatus,
} from "@/hooks";
import { getErrorMessage } from "@/utils/errors";
import { colors, radius, spacing, typography } from "@/theme";
import type { AppTabParamList } from "@/navigation/types";
import type {
  TimeOffRequest,
  TimeOffRequestStatus,
  TimedPermission,
  TimedPermissionStatus,
  OvertimeRequest,
  OvertimeRequestStatus,
  TimeOffType,
  PublicHoliday,
} from "@/types";

type ReqTab = "leave" | "permission" | "overtime";
type Route = RouteProp<AppTabParamList, "Requests">;

const TYPE_LABEL: Record<TimeOffType, string> = { CASUAL: "Casual", SICK: "Sick", EARNED: "Earned" };

const LEAVE_STATUS_TONE: Record<TimeOffRequestStatus, "success" | "warning" | "danger" | "neutral"> = {
  APPROVED: "success",
  PENDING: "warning",
  REJECTED: "danger",
  CANCELLED: "neutral",
};
const LEAVE_STATUS_LABEL: Record<TimeOffRequestStatus, string> = {
  APPROVED: "Approved",
  PENDING: "Pending",
  REJECTED: "Declined",
  CANCELLED: "Cancelled",
};

const PERMISSION_STATUS_TONE: Record<TimedPermissionStatus, "success" | "warning" | "danger" | "neutral"> = {
  pending: "warning",
  scheduled: "neutral",
  active: "success",
  resolved: "neutral",
  rejected: "danger",
};
const PERMISSION_STATUS_LABEL: Record<TimedPermissionStatus, string> = {
  pending: "Pending approval",
  scheduled: "Scheduled",
  active: "Active",
  resolved: "Resolved",
  rejected: "Declined",
};

const OVERTIME_STATUS_TONE: Record<OvertimeRequestStatus, "success" | "warning" | "danger" | "neutral"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};
const OVERTIME_STATUS_LABEL: Record<OvertimeRequestStatus, string> = {
  PENDING: "Awaiting review",
  APPROVED: "Approved",
  REJECTED: "Declined",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
function formatDateWithWeekday(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function RequestsScreen() {
  const route = useRoute<Route>();
  const [tab, setTab] = useState<ReqTab>(route.params?.tab ?? "leave");
  const [sheet, setSheet] = useState<ReqTab | null>(null);

  // Dashboard's "Request permission"/"Request overtime" shortcuts and the
  // Leave-balance card land here with a `tab` param — since this screen
  // stays mounted as a tab (React Navigation doesn't remount it), the
  // useState initializer above only runs once, so a second navigation with
  // a different tab needs this effect to actually switch the segment.
  useEffect(() => {
    if (route.params?.tab) setTab(route.params.tab);
  }, [route.params?.tab]);

  const leaveQuery = useLeaveRequests();
  const holidaysQuery = useHolidays();
  const cancelLeave = useCancelLeaveRequest();
  const permissionsQuery = useTimedPermissions(true);
  const overtimeQuery = useOvertimeStatus(true);

  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const balances = leaveQuery.data?.balances ?? [];
  const leaveRequests = leaveQuery.data?.requests ?? [];
  const pendingLeaveCount = leaveRequests.filter((r) => r.status === "PENDING").length;
  const todayKey = new Date().toISOString().slice(0, 10);
  const upcomingHolidays = (holidaysQuery.data ?? []).filter((h: PublicHoliday) => h.date.slice(0, 10) >= todayKey);

  const permissions = permissionsQuery.data ?? [];
  const overtimeRequests = overtimeQuery.data ?? [];

  const handleCancelLeave = async (id: string) => {
    setCancellingId(id);
    setCancelError(null);
    try {
      await cancelLeave.mutateAsync(id);
    } catch (error) {
      setCancelError(getErrorMessage(error, "Couldn't cancel that request."));
    } finally {
      setCancellingId(null);
    }
  };

  const TABS: { id: ReqTab; label: string; badge?: number }[] = [
    { id: "leave", label: "Leave", badge: pendingLeaveCount || undefined },
    { id: "permission", label: "Permission" },
    { id: "overtime", label: "Overtime" },
  ];

  return (
    <Screen scroll onRefresh={() => leaveQuery.refetch()} refreshing={leaveQuery.isRefetching}>
      <Text style={styles.kicker}>TIME OFF & APPROVALS</Text>
      <Text style={styles.title}>Requests</Text>

      <View style={styles.segRow}>
        {TABS.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => setTab(t.id)}
            style={[styles.segButton, tab === t.id && styles.segButtonActive]}
          >
            <Text style={[styles.segLabel, tab === t.id && styles.segLabelActive]}>{t.label}</Text>
            {t.badge ? (
              <View style={styles.segBadge}>
                <Text style={styles.segBadgeLabel}>{t.badge}</Text>
              </View>
            ) : null}
          </Pressable>
        ))}
      </View>

      {tab === "leave" ? (
        <>
          {leaveQuery.isLoading ? (
            <LoadingView label="Loading your leave…" />
          ) : (
            <>
              <View style={styles.statGrid}>
                {balances.map((b, i) => (
                  <View key={b.type} style={[styles.statCell, i === 1 && styles.statCellMiddle]}>
                    <Text style={styles.statLabel}>{TYPE_LABEL[b.type].toUpperCase()}</Text>
                    <View style={styles.statValueRow}>
                      <Text style={styles.statValue}>{b.remaining}</Text>
                      <Text style={styles.statQuota}> / {b.quota}</Text>
                    </View>
                    <View style={styles.statTrack}>
                      <View
                        style={[styles.statFill, { width: `${b.quota > 0 ? (b.remaining / b.quota) * 100 : 0}%` }]}
                      />
                    </View>
                  </View>
                ))}
              </View>

              <Button label="Request leave" onPress={() => setSheet("leave")} style={styles.cta} />

              <Text style={styles.sectionLabel}>THIS YEAR</Text>
              {cancelError ? <Text style={styles.errorText}>{cancelError}</Text> : null}
              {leaveRequests.length === 0 ? (
                <EmptyState title="Nothing here yet" message="Requests you submit show up here." />
              ) : (
                <View style={styles.list}>
                  {leaveRequests.map((r: TimeOffRequest) => {
                    const rangeLabel =
                      r.startDate === r.endDate
                        ? formatDate(r.startDate)
                        : `${formatDate(r.startDate)} – ${formatDate(r.endDate)}`;
                    return (
                      <View key={r.id} style={styles.rowWrap}>
                        <View style={styles.row}>
                          <View style={styles.rowText}>
                            <Text style={styles.rowTitle}>{TYPE_LABEL[r.type]}</Text>
                            <Text style={styles.rowMeta}>
                              {rangeLabel} · {r.days} day{r.days === 1 ? "" : "s"}
                            </Text>
                            {r.status === "REJECTED" && r.reviewNote ? (
                              <Text style={styles.reviewNote}>"{r.reviewNote}"</Text>
                            ) : null}
                          </View>
                          <StatusBadge label={LEAVE_STATUS_LABEL[r.status]} tone={LEAVE_STATUS_TONE[r.status]} />
                        </View>
                        {r.status === "PENDING" ? (
                          <Pressable onPress={() => handleCancelLeave(r.id)} disabled={cancellingId === r.id} hitSlop={8}>
                            <Text style={styles.cancelLink}>
                              {cancellingId === r.id ? "Cancelling…" : "Cancel request"}
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              )}

              <Text style={styles.sectionLabel}>UPCOMING HOLIDAYS · NOT DEDUCTED</Text>
              {upcomingHolidays.length === 0 ? (
                <EmptyState title="No upcoming holidays" message="None added for the rest of this year yet." />
              ) : (
                <View style={styles.list}>
                  {upcomingHolidays.map((h) => (
                    <View key={h.id} style={styles.holidayRow}>
                      <Text style={styles.rowTitle}>{h.name}</Text>
                      <Text style={styles.rowMeta}>{formatDateWithWeekday(h.date)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </>
      ) : null}

      {tab === "permission" ? (
        <>
          <View style={styles.explainCard}>
            <Text style={styles.explainTitle}>Pause your work time for a few hours today</Text>
            <Text style={styles.explainBody}>
              Stepping out for a while? A permission window stops the clock for exactly that stretch, so the gap
              isn't read as you going missing. Takes effect immediately — your admin just sees the record.
            </Text>
          </View>
          <Button label="New permission window" onPress={() => setSheet("permission")} style={styles.cta} />

          <Text style={styles.sectionLabel}>PERMISSION WINDOWS</Text>
          {permissions.length === 0 ? (
            <EmptyState title="Nothing here yet" message="Requests you submit show up here." />
          ) : (
            <View style={styles.list}>
              {permissions.map((p: TimedPermission) => (
                <View key={p.id} style={styles.rowWrap}>
                  <View style={styles.row}>
                    <View style={styles.rowText}>
                      <Text style={styles.rowTitle}>
                        {formatTime(p.startTime)} – {formatTime(p.endTime)}
                      </Text>
                      <Text style={styles.rowMeta}>{formatDateWithWeekday(p.startTime)}</Text>
                    </View>
                    <StatusBadge
                      label={PERMISSION_STATUS_LABEL[p.status]}
                      tone={PERMISSION_STATUS_TONE[p.status]}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      ) : null}

      {tab === "overtime" ? (
        <>
          <View style={styles.explainCard}>
            <Text style={styles.explainTitle}>Staying past shift end?</Text>
            <Text style={styles.explainBody}>
              Tell us roughly when you'll finish. Your check-out reminder moves to that time instead of your
              shift end, and you can log what you worked on when you check out.
            </Text>
          </View>
          <Button label="Request overtime" onPress={() => setSheet("overtime")} style={styles.cta} />

          <Text style={styles.sectionLabel}>OVERTIME</Text>
          {overtimeRequests.length === 0 ? (
            <EmptyState title="Nothing here yet" message="Requests you submit show up here." />
          ) : (
            <View style={styles.list}>
              {overtimeRequests.map((r: OvertimeRequest) => (
                <View key={r.id} style={styles.rowWrap}>
                  <View style={styles.row}>
                    <View style={styles.rowText}>
                      <Text style={styles.rowTitle}>Until ~{formatTime(r.estimatedEndAt)}</Text>
                      <Text style={styles.rowMeta}>{r.reason}</Text>
                    </View>
                    <StatusBadge label={OVERTIME_STATUS_LABEL[r.status]} tone={OVERTIME_STATUS_TONE[r.status]} />
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      ) : null}

      <BottomSheet visible={sheet === "leave"} onClose={() => setSheet(null)} kicker="TIME OFF" title="Request leave">
        <LeaveRequestSheet onDone={() => setSheet(null)} />
      </BottomSheet>
      <BottomSheet
        visible={sheet === "permission"}
        onClose={() => setSheet(null)}
        kicker="TODAY"
        title="Pause my work time"
      >
        <PermissionRequestSheet onDone={() => setSheet(null)} />
      </BottomSheet>
      <BottomSheet
        visible={sheet === "overtime"}
        onClose={() => setSheet(null)}
        kicker="TODAY"
        title="Request overtime"
      >
        <OvertimeRequestSheet onDone={() => setSheet(null)} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { ...typography.label, letterSpacing: 2, color: colors.textSecondary },
  title: { ...typography.h1, color: colors.textPrimary, marginTop: spacing.xs },
  segRow: {
    flexDirection: "row",
    gap: 4,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    padding: 4,
    marginTop: spacing.md,
  },
  segButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: radius.sm - 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  segButtonActive: { backgroundColor: colors.primaryMuted },
  segLabel: { ...typography.bodyStrong, fontSize: 12.5, color: colors.textSecondary },
  segLabelActive: { color: colors.primaryDark },
  segBadge: {
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 99,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  segBadgeLabel: { fontSize: 9.5, fontWeight: "700", color: colors.primaryText },
  statGrid: {
    flexDirection: "row",
    marginTop: spacing.lg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  statCell: { flex: 1, backgroundColor: colors.surface, padding: spacing.sm + 3 },
  statCellMiddle: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border },
  statLabel: { fontSize: 9, letterSpacing: 1.5, color: colors.textMuted, fontWeight: "600" },
  statValueRow: { flexDirection: "row", alignItems: "baseline", marginTop: 4 },
  statValue: { ...typography.bodyStrong, fontSize: 20, color: colors.textPrimary },
  statQuota: { ...typography.caption, color: colors.textMuted, fontSize: 11 },
  statTrack: { height: 3, borderRadius: 99, backgroundColor: colors.surfaceMuted, marginTop: 6, overflow: "hidden" },
  statFill: { height: "100%", borderRadius: 99, backgroundColor: colors.primary },
  cta: { marginTop: spacing.md },
  explainCard: {
    marginTop: spacing.lg,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md - 2,
  },
  explainTitle: { ...typography.bodyStrong, fontSize: 14, color: colors.textPrimary },
  explainBody: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs, lineHeight: 18 },
  sectionLabel: {
    fontSize: 9,
    letterSpacing: 1.5,
    color: colors.textMuted,
    fontWeight: "600",
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  errorText: { ...typography.caption, color: colors.danger, marginBottom: spacing.sm },
  list: { gap: spacing.sm },
  rowWrap: {
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm + 4,
  },
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { ...typography.bodyStrong, fontSize: 14, color: colors.textPrimary },
  rowMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  reviewNote: { ...typography.caption, color: colors.textSecondary, marginTop: 4, fontStyle: "italic" },
  cancelLink: { ...typography.caption, color: colors.danger, marginTop: spacing.sm },
  holidayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
});
