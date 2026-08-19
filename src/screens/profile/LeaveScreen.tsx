import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen, Button, LoadingView, ErrorView, StatusBadge, EmptyState } from "@/components/ui";
import { useCancelLeaveRequest, useHolidays, useLeaveRequests } from "@/hooks";
import { getErrorMessage } from "@/utils/errors";
import { colors, spacing, typography } from "@/theme";
import type { ProfileStackParamList } from "@/navigation/types";
import type { PublicHoliday, TimeOffRequest, TimeOffRequestStatus, TimeOffType } from "@/types";

type Nav = NativeStackNavigationProp<ProfileStackParamList, "Leave">;

const TYPE_LABEL: Record<TimeOffType, string> = {
  CASUAL: "Casual",
  SICK: "Sick",
  EARNED: "Earned",
};

const STATUS_TONE: Record<TimeOffRequestStatus, "success" | "warning" | "danger" | "neutral"> = {
  APPROVED: "success",
  PENDING: "warning",
  REJECTED: "danger",
  CANCELLED: "neutral",
};

const STATUS_LABEL: Record<TimeOffRequestStatus, string> = {
  APPROVED: "Approved",
  PENDING: "Pending",
  REJECTED: "Declined",
  CANCELLED: "Cancelled",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function formatDateWithWeekday(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function HolidayRow({ holiday }: { holiday: PublicHoliday }) {
  return (
    <View style={styles.holidayRow}>
      <Text style={styles.holidayName}>{holiday.name}</Text>
      <Text style={styles.holidayDate}>{formatDateWithWeekday(holiday.date)}</Text>
    </View>
  );
}

interface RequestRowProps {
  request: TimeOffRequest;
  onCancel: (id: string) => void;
  cancelling: boolean;
}

function RequestRow({ request, onCancel, cancelling }: RequestRowProps) {
  const rangeLabel =
    request.startDate === request.endDate
      ? formatDate(request.startDate)
      : `${formatDate(request.startDate)} – ${formatDate(request.endDate)}`;
  return (
    <View style={styles.requestRowWrap}>
      <View style={styles.requestRow}>
        <View style={styles.requestRowText}>
          <Text style={styles.requestType}>{TYPE_LABEL[request.type]}</Text>
          <Text style={styles.requestMeta}>
            {rangeLabel} · {request.days} day{request.days === 1 ? "" : "s"}
          </Text>
          {request.status === "REJECTED" && request.reviewNote ? (
            <Text style={styles.reviewNote}>“{request.reviewNote}”</Text>
          ) : null}
        </View>
        <StatusBadge label={STATUS_LABEL[request.status]} tone={STATUS_TONE[request.status]} />
      </View>
      {request.status === "PENDING" ? (
        <Pressable onPress={() => onCancel(request.id)} disabled={cancelling} hitSlop={8}>
          <Text style={styles.cancelLink}>{cancelling ? "Cancelling…" : "Cancel request"}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function LeaveScreen() {
  const navigation = useNavigation<Nav>();
  const query = useLeaveRequests();
  const holidaysQuery = useHolidays();
  const cancelMutation = useCancelLeaveRequest();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  if (query.isLoading) return <LoadingView label="Loading your leave…" />;
  if (query.isError) {
    return (
      <ErrorView message={getErrorMessage(query.error, "Couldn't load leave.")} onRetry={() => query.refetch()} />
    );
  }

  const balances = query.data?.balances ?? [];
  const requests = query.data?.requests ?? [];
  const todayKey = new Date().toISOString().slice(0, 10);
  const upcomingHolidays = (holidaysQuery.data ?? []).filter((h) => h.date.slice(0, 10) >= todayKey);

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    setCancelError(null);
    try {
      await cancelMutation.mutateAsync(id);
    } catch (error) {
      setCancelError(getErrorMessage(error, "Couldn't cancel that request."));
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <Screen scroll onRefresh={() => query.refetch()} refreshing={query.isRefetching}>
      <Text style={styles.kicker}>{new Date().getFullYear()}</Text>
      <Text style={styles.title}>Leave</Text>

      <View style={styles.statGrid}>
        {balances.map((b, i) => (
          <View
            key={b.type}
            style={[styles.statCell, i === 1 && styles.statCellMiddle]}
          >
            <Text style={styles.statLabel}>{TYPE_LABEL[b.type].toUpperCase()}</Text>
            <Text style={styles.statValue}>{b.remaining}</Text>
            <Text style={styles.statSub}>of {b.quota} left</Text>
          </View>
        ))}
      </View>

      <Button
        label="Request leave"
        onPress={() => navigation.navigate("RequestLeave")}
        style={styles.cta}
      />

      <Text style={styles.sectionLabel}>UPCOMING HOLIDAYS</Text>
      {upcomingHolidays.length === 0 ? (
        <EmptyState title="No upcoming holidays" message="None added for the rest of this year yet." />
      ) : (
        <View style={styles.requestList}>
          {upcomingHolidays.map((h) => (
            <HolidayRow key={h.id} holiday={h} />
          ))}
        </View>
      )}

      <Text style={styles.sectionLabel}>THIS YEAR</Text>
      {cancelError ? <Text style={styles.errorText}>{cancelError}</Text> : null}
      {requests.length === 0 ? (
        <EmptyState title="No leave requests yet" message="Requests you submit will show up here." />
      ) : (
        <View style={styles.requestList}>
          {requests.map((r) => (
            <RequestRow key={r.id} request={r} onCancel={handleCancel} cancelling={cancellingId === r.id} />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { ...typography.label, letterSpacing: 2, color: colors.textSecondary },
  title: { ...typography.h1, color: colors.textPrimary, marginTop: spacing.xs },
  statGrid: {
    flexDirection: "row",
    marginTop: spacing.lg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  statCell: { flex: 1, backgroundColor: colors.surface, padding: spacing.sm + 5, alignItems: "center" },
  statCellMiddle: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border },
  statLabel: { fontSize: 9, letterSpacing: 1.5, color: colors.textMuted, fontWeight: "600" },
  statValue: { ...typography.h2, color: colors.textPrimary, marginTop: spacing.xs },
  statSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  cta: { marginTop: spacing.lg },
  sectionLabel: {
    fontSize: 9,
    letterSpacing: 1.5,
    color: colors.textMuted,
    fontWeight: "600",
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  requestList: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  requestRowWrap: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  requestRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  requestRowText: { flex: 1, minWidth: 0 },
  requestType: { ...typography.bodyStrong, color: colors.textPrimary },
  reviewNote: { ...typography.caption, color: colors.textSecondary, marginTop: 2, fontStyle: "italic" },
  cancelLink: { ...typography.caption, color: colors.danger, marginTop: spacing.xs + 2 },
  errorText: { ...typography.caption, color: colors.danger, marginBottom: spacing.sm },
  requestMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  holidayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  holidayName: { ...typography.bodyStrong, color: colors.textPrimary, flex: 1, minWidth: 0 },
  holidayDate: { ...typography.caption, color: colors.textSecondary, marginLeft: spacing.sm },
});
