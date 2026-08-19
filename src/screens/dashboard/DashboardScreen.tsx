import { useMemo, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { StyleSheet, Text, View } from "react-native";
import { Screen, Button, LoadingView, ErrorView } from "@/components/ui";
import { PresenceCard, WeeklyHoursChart, LateNoticeCard, PermissionStatusCard } from "@/components/dashboard";
import {
  useAuth,
  useAttendanceStatus,
  useResolvedGeofenceTarget,
  useGeofence,
  useRecentAttendance,
  useTimedPermissions,
} from "@/hooks";
import { useAttendanceSessionStore } from "@/store/attendanceSessionStore";
import { startLocationTracking } from "@/services/locationTracking";
import { groupAttendanceByDay } from "@/utils/attendanceGrouping";
import { getErrorMessage } from "@/utils/errors";
import { formatDistance } from "@/utils/geo";
import { colors, spacing, typography } from "@/theme";
import type { AppTabParamList, DashboardStackParamList } from "@/navigation/types";

type Nav = NativeStackNavigationProp<DashboardStackParamList, "DashboardHome">;

function formatTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

const WORK_MODE_LABEL: Record<string, string> = {
  OFFICE: "Office",
  WFH: "Home",
  FIELD: "Anywhere",
};

export function DashboardScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const isTracking = useAttendanceSessionStore((s) => s.isTracking);
  const trackingWarning = useAttendanceSessionStore((s) => s.trackingWarning);
  const statusQuery = useAttendanceStatus(user?.employeeCode);
  // Computed off statusQuery.data directly (not the `status` var below,
  // which is only derived after the loading/error guards) — this hook call
  // must stay unconditional, so it can't wait for those guards to pass.
  const hasActiveSession = statusQuery.data?.exists
    ? statusQuery.data.checkedIn && !statusQuery.data.checkedOut
    : false;
  const permissionsQuery = useTimedPermissions(hasActiveSession);
  const target = useResolvedGeofenceTarget();
  const geofence = useGeofence(target);
  const recentQuery = useRecentAttendance(14);
  const [enablingSharing, setEnablingSharing] = useState(false);

  const daySummaries = useMemo(
    () => groupAttendanceByDay(recentQuery.data?.records ?? []),
    [recentQuery.data],
  );

  // Today's open (not yet checked out) session, straight from the same
  // bearer-authenticated history the weekly chart already uses — lets us
  // (re)start tracking without needing the attendance id from anywhere else.
  // Deliberately not sourced from /api/kiosk/status: that endpoint is
  // PIN-less (keyed only by employee code) and the attendance id doubles as
  // an unguessable capability token for location pings, so it must never be
  // handed out unauthenticated.
  const todayKey = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  })();
  const activeCheckIn = daySummaries.find((d) => d.dateKey === todayKey && !d.checkOut)?.checkIn ?? null;

  if (statusQuery.isLoading) return <LoadingView label="Loading your status…" />;
  if (statusQuery.isError) {
    return (
      <ErrorView
        message={getErrorMessage(statusQuery.error, "Couldn't load today's status.")}
        onRetry={() => statusQuery.refetch()}
      />
    );
  }

  const status = statusQuery.data;
  const checkedIn = status?.exists ? status.checkedIn : false;
  const checkedOut = status?.exists ? status.checkedOut : false;
  const checkInAt = status?.exists ? status.checkInAt : null;
  const isPaused = status?.exists ? status.isPaused : false;
  const leaveType = status?.exists ? status.leaveType : "NONE";
  const lateMinutes = status?.exists ? status.lateMinutes : null;

  // Whichever of today's timed-permission requests is currently relevant —
  // for display, that's the most recent non-resolved one (a rejected one is
  // still worth showing so the employee sees the decline). For deciding
  // whether a *new* request can be started, REJECTED doesn't count either —
  // same rule the backend itself enforces — so the button only stays hidden
  // while one is genuinely pending/scheduled/active.
  const permissions = hasActiveSession ? permissionsQuery.data ?? [] : [];
  const currentPermission = permissions.find((p) => p.status !== "resolved") ?? null;
  const hasOpenPermissionRequest =
    currentPermission?.status === "pending" ||
    currentPermission?.status === "scheduled" ||
    currentPermission?.status === "active";
  const pauseReason: "geofence" | "permission" = currentPermission?.status === "active" ? "permission" : "geofence";

  const rangeLabel =
    user?.workMode === "FIELD"
      ? "Anywhere"
      : geofence.distanceMeters !== null
        ? formatDistance(geofence.distanceMeters)
        : "—";

  const goCheckInOut = () => {
    navigation.getParent<BottomTabNavigationProp<AppTabParamList>>()?.navigate("CheckIn");
  };

  // startLocationTracking never throws — every failure mode (permission
  // denied, native task error) is surfaced via the store's trackingWarning
  // instead, which PresenceCard already renders. `enablingSharing` here is
  // purely for the button's own loading state.
  const handleEnableSharing = async () => {
    if (!activeCheckIn) return;
    setEnablingSharing(true);
    await startLocationTracking(activeCheckIn.id, activeCheckIn.timestamp);
    setEnablingSharing(false);
  };

  const initials = (user?.name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Screen scroll onRefresh={() => statusQuery.refetch()} refreshing={statusQuery.isRefetching}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.kicker}>
            {new Date()
              .toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })
              .toUpperCase()}
            {"  ·  "}
            {new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
          </Text>
          <Text style={styles.greeting}>{user?.name?.split(" ")[0] ?? "there"}</Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarLabel}>{initials}</Text>
        </View>
      </View>

      <PresenceCard
        isTracking={isTracking}
        checkInAt={checkedIn && !checkedOut ? checkInAt : null}
        isPaused={checkedIn && !checkedOut ? isPaused : false}
        pauseReason={pauseReason}
        trackingWarning={trackingWarning}
        onViewMap={() => navigation.navigate("LiveMap")}
        onEnableSharing={!isTracking && activeCheckIn ? handleEnableSharing : undefined}
        enablingSharing={enablingSharing}
      />

      {checkedIn && !checkedOut && currentPermission ? (
        <PermissionStatusCard permission={currentPermission} />
      ) : null}

      <View style={styles.statGrid}>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>IN AT</Text>
          <Text style={styles.statValue}>{formatTime(checkInAt)}</Text>
        </View>
        <View style={[styles.statCell, styles.statCellMiddle]}>
          <Text style={styles.statLabel}>MODE</Text>
          <Text style={styles.statValue}>{WORK_MODE_LABEL[user?.workMode ?? "OFFICE"]}</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statLabel}>RANGE</Text>
          <Text style={[styles.statValue, geofence.withinRadius === false && styles.statValueWarn]}>
            {rangeLabel}
          </Text>
        </View>
      </View>

      {leaveType !== "NONE" ? <LateNoticeCard leaveType={leaveType} lateMinutes={lateMinutes} /> : null}

      <View style={styles.weeklyCard}>
        <WeeklyHoursChart days={daySummaries} />
      </View>

      <Button
        label={checkedIn && !checkedOut ? "Go to check out" : "Go to check in"}
        onPress={goCheckInOut}
        style={styles.cta}
      />

      {checkedIn && !checkedOut && !hasOpenPermissionRequest ? (
        <Button
          label="Request permission"
          variant="secondary"
          onPress={() => navigation.navigate("RequestPermission")}
          style={styles.secondaryCta}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  kicker: { ...typography.label, letterSpacing: 2, color: colors.textSecondary },
  greeting: { ...typography.h1, color: colors.textPrimary, marginTop: spacing.xs + 2 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 99,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLabel: { ...typography.bodyStrong, color: colors.textSecondary },
  statGrid: {
    flexDirection: "row",
    marginTop: spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  statCell: { flex: 1, backgroundColor: colors.surface, padding: spacing.sm + 5 },
  statCellMiddle: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border },
  statLabel: { fontSize: 9, letterSpacing: 1.5, color: colors.textMuted, fontWeight: "600" },
  statValue: { ...typography.bodyStrong, color: colors.textPrimary, marginTop: spacing.xs + 2 },
  statValueWarn: { color: colors.danger },
  weeklyCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  cta: { marginTop: spacing.lg },
  secondaryCta: { marginTop: spacing.sm },
});
