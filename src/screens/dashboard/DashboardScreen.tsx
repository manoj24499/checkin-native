import { useMemo, useRef, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  Screen,
  LoadingView,
  ErrorView,
  Card,
  IconButton,
  ListRow,
  SectionHeader,
  type ActionTileProps,
} from "@/components/ui";
import {
  PresenceCard,
  WeeklyHoursChart,
  LateNoticeCard,
  PermissionStatusCard,
  OvertimeStatusCard,
  LeaveNoticeCard,
  WorkSegmentCard,
  FieldVisitCard,
  AssignedPlacesCard,
  LeaveBalanceCard,
  RecentHistoryCard,
  PendingSyncCard,
  ReimbursementCard,
} from "@/components/dashboard";
import {
  useAuth,
  useEffectiveAttendanceStatus,
  useResolvedGeofenceTarget,
  useGeofence,
  useRecentAttendance,
  useTimedPermissions,
  useOvertimeStatus,
  useTodayLeave,
  useWorkSegment,
  useSwitchWorkSegment,
  useFieldSummary,
  useLeaveRequests,
} from "@/hooks";
import { useAttendanceSessionStore } from "@/store/attendanceSessionStore";
import { startLocationTracking } from "@/services/locationTracking";
import { formatDuration, groupAttendanceByDay } from "@/utils/attendanceGrouping";
import { getErrorMessage } from "@/utils/errors";
import { formatDistance } from "@/utils/geo";
import { colors, shadows, spacing, typography } from "@/theme";
import type { AppTabParamList, DashboardStackParamList } from "@/navigation/types";
import type { WorkSegmentMode } from "@/types";

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

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

// "HH:mm" shift start/end -> "of 9h" / "of 8h 30m" (overnight shifts wrap).
function shiftLengthLabel(start: string | null, end: string | null) {
  if (!start || !end) return undefined;
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + (m || 0);
  };
  const mins = (toMin(end) - toMin(start) + 1440) % 1440;
  if (!mins || !Number.isFinite(mins)) return undefined;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `of ${h}h${m ? ` ${m}m` : ""}`;
}

export function DashboardScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const isTracking = useAttendanceSessionStore((s) => s.isTracking);
  const trackingWarning = useAttendanceSessionStore((s) => s.trackingWarning);
  // Server status with anything saved offline (not yet sent) applied on top —
  // see useEffectiveAttendanceStatus. `statusQuery` stays the raw server query.
  const effective = useEffectiveAttendanceStatus(user?.employeeCode);
  const statusQuery = effective.query;
  // Computed off statusQuery.data directly (not the `status` var below,
  // which is only derived after the loading/error guards) — this hook call
  // must stay unconditional, so it can't wait for those guards to pass.
  const hasActiveSession = statusQuery.data?.exists
    ? statusQuery.data.checkedIn && !statusQuery.data.checkedOut
    : false;
  const permissionsQuery = useTimedPermissions(hasActiveSession);
  const overtimeQuery = useOvertimeStatus(hasActiveSession);
  const todayLeave = useTodayLeave();
  const isFieldWorker = user?.workMode === "FIELD";
  const segmentQuery = useWorkSegment(hasActiveSession && isFieldWorker);
  const switchSegment = useSwitchWorkSegment();
  // Same query (and key) FieldVisitCard already polls while a Field session
  // is open — read here for the hero's distance and visit count.
  const fieldSummaryQuery = useFieldSummary(hasActiveSession && isFieldWorker);
  // Same query LeaveBalanceCard / the Requests tab dot use — drives the
  // bell's dot (pending leave requests).
  const leaveQuery = useLeaveRequests();
  // A WFH employee who chose Office today (see CheckInOutScreen's Home/
  // Office picker) needs the RANGE stat and PresenceCard geofenced against
  // the office too, not home — same reasoning as LiveMapScreen's identical
  // check.
  const isWfhOfficeDay =
    user?.workMode === "WFH" && statusQuery.data?.exists === true && statusQuery.data.checkInMode === "OFFICE";
  const target = useResolvedGeofenceTarget(isWfhOfficeDay ? "OFFICE" : undefined);
  const geofence = useGeofence(target);
  const recentQuery = useRecentAttendance(14);
  const [enablingSharing, setEnablingSharing] = useState(false);
  const [segmentError, setSegmentError] = useState<string | null>(null);
  // Home's "Visit" tile: opens FieldVisitCard's form and scrolls to it.
  const scrollRef = useRef<ScrollView>(null);
  const fieldVisitY = useRef(0);
  const [visitSignal, setVisitSignal] = useState(0);

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
  // Today's row from the same history (open or closed) — for the "Today"
  // list's method / check-out time / duration.
  const todaySummary = daySummaries.find((d) => d.dateKey === todayKey) ?? null;

  if (effective.isLoading) return <LoadingView label="Loading your status…" />;
  if (effective.isError) {
    return (
      <ErrorView
        message={getErrorMessage(statusQuery.error, "Couldn't load today's status.")}
        onRetry={() => statusQuery.refetch()}
      />
    );
  }

  const status = effective.data;
  const checkedIn = status?.exists ? status.checkedIn : false;
  const checkedOut = status?.exists ? status.checkedOut : false;
  const checkInAt = status?.exists ? status.checkInAt : null;
  const isPaused = status?.exists ? status.isPaused : false;
  const leaveType = status?.exists ? status.leaveType : "NONE";
  const lateMinutes = status?.exists ? status.lateMinutes : null;
  const sessionOpen = checkedIn && !checkedOut;

  // Whichever of today's timed-permission requests is currently relevant —
  // for display, that's the most recent non-resolved one (a rejected one is
  // still worth showing so the employee sees the decline).
  const permissions = hasActiveSession ? permissionsQuery.data ?? [] : [];
  const currentPermission = permissions.find((p) => p.status !== "resolved") ?? null;
  const pauseReason: "geofence" | "permission" = currentPermission?.status === "active" ? "permission" : "geofence";

  // The active overtime request, if any — "active" (not yet closed out at a
  // checkout) is the only thing that matters for showing this and hiding
  // the request button; unlike TimedPermission's status, `status` here
  // never affects whether one exists (see the type's own comment).
  const overtimeRequests = hasActiveSession ? overtimeQuery.data ?? [] : [];
  const currentOvertime = overtimeRequests.find((r) => r.active) ?? null;

  const rangeLabel =
    user?.workMode === "FIELD"
      ? "Anywhere"
      : geofence.distanceMeters !== null
        ? formatDistance(geofence.distanceMeters)
        : "—";

  const tabs = () => navigation.getParent<BottomTabNavigationProp<AppTabParamList>>();
  const goCheckInOut = () => {
    tabs()?.navigate("CheckIn");
  };
  const goHistory = () => tabs()?.navigate("Profile", { screen: "History" });

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

  const handleSwitchSegment = async (mode: WorkSegmentMode) => {
    setSegmentError(null);
    try {
      await switchSegment.mutateAsync(mode);
    } catch (error) {
      setSegmentError(getErrorMessage(error, "Couldn't switch your mode. Please try again."));
    }
  };

  const initials = (user?.name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  // ---- Hero (PresenceCard) inputs ----
  const showFieldVisit = sessionOpen && isFieldWorker;
  const fieldSummary = fieldSummaryQuery.data;
  const fieldActive = showFieldVisit && fieldSummary?.active === true;
  const fieldDay = status?.exists ? status.checkInMode !== "OFFICE" : true;
  const heroDistance = fieldActive && fieldDay && fieldSummary?.active ? fieldSummary.distanceMeters : null;
  const visitCount = fieldSummary?.active ? fieldSummary.visits.length : 0;

  const heroChips: string[] = [];
  if (sessionOpen) {
    if (isFieldWorker) {
      const seg = segmentQuery.data?.mode === "OFFICE" ? "Office" : "Field";
      heroChips.push(fieldActive ? `${seg} · ${visitCount} visit${visitCount === 1 ? "" : "s"}` : seg);
    } else {
      const mode = WORK_MODE_LABEL[isWfhOfficeDay ? "OFFICE" : user?.workMode ?? "OFFICE"];
      heroChips.push(geofence.distanceMeters !== null ? `${mode} · ${rangeLabel}` : mode);
    }
  }

  const heroActions: (ActionTileProps & { key?: string })[] = isFieldWorker
    ? [
        { key: "map", icon: "pin", label: "Map", onPress: () => navigation.navigate("LiveMap") },
        { key: "places", icon: "navigate", label: "Places", onPress: () => navigation.navigate("TodaysPlaces") },
        {
          key: "visit",
          icon: "plus",
          label: "Visit",
          // Logging a visit needs an open Field session (FieldVisitCard only
          // renders then), same as before.
          disabled: !showFieldVisit,
          onPress: () => {
            setVisitSignal((n) => n + 1);
            scrollRef.current?.scrollTo({ y: Math.max(0, fieldVisitY.current - spacing.md), animated: true });
          },
        },
      ]
    : [
        { key: "leave", icon: "calendar", label: "Leave", onPress: () => tabs()?.navigate("Requests", { tab: "leave" }) },
        {
          key: "permission",
          icon: "clock",
          label: "Permission",
          onPress: () => tabs()?.navigate("Requests", { tab: "permission" }),
        },
        { key: "history", icon: "history", label: "History", onPress: goHistory },
      ];

  // ---- "Today" list ----
  const lateTone = leaveType === "HALF_DAY" ? "danger" : "warning";
  const checkInValue =
    lateMinutes == null ? undefined : lateMinutes > 0 ? `${lateMinutes} min late` : "On time";
  const checkInMethod = todaySummary?.checkIn?.method;
  const checkInSub = effective.pendingCheckIn ? "Pending sync" : checkInMethod;
  const showPermissionRow = sessionOpen && !!currentPermission;
  const showOvertimeRow = sessionOpen && !!currentOvertime;
  const checkOutRecord = checkedOut ? todaySummary?.checkOut ?? null : null;
  const todayRows = [
    checkInAt ? "checkIn" : null,
    checkOutRecord ? "checkOut" : null,
    showPermissionRow ? "permission" : null,
    showOvertimeRow ? "overtime" : null,
  ].filter(Boolean) as string[];
  const dividerFor = (key: string) => todayRows.indexOf(key) > 0;

  const pendingLeave = (leaveQuery.data?.requests ?? []).some((r) => r.status === "PENDING");

  return (
    <Screen contentStyle={styles.screenContent}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={statusQuery.isRefetching}
            onRefresh={() => statusQuery.refetch()}
            tintColor={colors.ink}
            colors={[colors.ink]}
            progressBackgroundColor={colors.lime}
          />
        }
      >
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={styles.avatar}>
              <Text style={styles.avatarLabel}>{initials}</Text>
            </View>
            <View style={styles.headerText}>
              <Text style={styles.greetingKicker}>{greeting()}</Text>
              <Text style={styles.greeting} numberOfLines={1}>
                {user?.name?.split(" ")[0] ?? "there"}
              </Text>
            </View>
          </View>
          <IconButton
            icon="bell"
            variant="ink"
            shape="rounded"
            size={44}
            badge={pendingLeave}
            accessibilityLabel="Requests"
            onPress={() => tabs()?.navigate("Requests", { tab: "leave" })}
          />
        </View>

        <PresenceCard
          isTracking={isTracking}
          checkInAt={sessionOpen ? checkInAt : null}
          isPaused={sessionOpen ? isPaused : false}
          pauses={sessionOpen && status?.exists ? status.pauses : []}
          pauseReason={pauseReason}
          trackingWarning={trackingWarning}
          onEnableSharing={!isTracking && activeCheckIn ? handleEnableSharing : undefined}
          enablingSharing={enablingSharing}
          checkedIn={sessionOpen}
          onPrimaryAction={goCheckInOut}
          pendingSync={!!effective.pendingCheckIn}
          distanceMeters={heroDistance}
          valueSuffix={status?.exists ? shiftLengthLabel(status.shiftStartTime, status.shiftEndTime) : undefined}
          chips={heroChips}
          actions={heroActions}
        />

        {!checkedIn && todayLeave ? <LeaveNoticeCard type={todayLeave.type} /> : null}

        {isFieldWorker ? <ReimbursementCard /> : null}

        {todayRows.length > 0 ? (
          <>
            <SectionHeader title="Today" onAction={goHistory} />
            <Card style={styles.listCard}>
              {checkInAt ? (
                <ListRow
                  icon="arrowDownLeft"
                  title="Checked in"
                  subtitle={`Today · ${formatTime(checkInAt)}`}
                  value={checkInValue}
                  valueTone={lateMinutes && lateMinutes > 0 ? lateTone : "success"}
                  valueSub={checkInSub}
                />
              ) : null}
              {checkOutRecord ? (
                <ListRow
                  icon="arrowUpRight"
                  title="Checked out"
                  subtitle={`Today · ${formatTime(checkOutRecord.timestamp)}`}
                  value={todaySummary?.durationMs != null ? formatDuration(todaySummary.durationMs) : undefined}
                  valueSub={todaySummary?.durationMs != null ? "worked" : undefined}
                  divider={dividerFor("checkOut")}
                />
              ) : null}
              {showPermissionRow && currentPermission ? (
                <PermissionStatusCard permission={currentPermission} asRow divider={dividerFor("permission")} />
              ) : null}
              {showOvertimeRow && currentOvertime ? (
                <OvertimeStatusCard request={currentOvertime} asRow divider={dividerFor("overtime")} />
              ) : null}
            </Card>
          </>
        ) : null}

        {sessionOpen && isFieldWorker && segmentQuery.data?.mode ? (
          <>
            <WorkSegmentCard
              mode={segmentQuery.data.mode}
              onSwitch={handleSwitchSegment}
              switching={switchSegment.isPending}
            />
            {segmentError ? <Text style={styles.segmentError}>{segmentError}</Text> : null}
          </>
        ) : null}

        {isFieldWorker ? <AssignedPlacesCard onOpen={() => navigation.navigate("TodaysPlaces")} /> : null}

        {showFieldVisit ? (
          <View onLayout={(e) => (fieldVisitY.current = e.nativeEvent.layout.y)}>
            <FieldVisitCard openSignal={visitSignal} />
          </View>
        ) : null}

        <PendingSyncCard employeeCode={user?.employeeCode} />

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

        <Card style={styles.weeklyCard}>
          <WeeklyHoursChart days={daySummaries} />
        </Card>

        <RecentHistoryCard days={daySummaries} onSeeAll={goHistory} />

        <LeaveBalanceCard onPress={() => tabs()?.navigate("Requests", { tab: "leave" })} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: { padding: 0 },
  scrollContent: { flexGrow: 1, padding: spacing.md, paddingBottom: spacing.lg },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.xs },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: spacing.sm + 2, flex: 1, minWidth: 0 },
  headerText: { flex: 1, minWidth: 0 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLabel: { ...typography.bodyStrong, fontSize: 14, fontFamily: "Inter_700Bold", fontWeight: "700", color: colors.lime },
  greetingKicker: { ...typography.caption, fontSize: 12, color: colors.onLimeSecondary },
  greeting: { ...typography.section, color: colors.ink },
  listCard: { paddingVertical: spacing.xs + 2, paddingHorizontal: spacing.md - 2 },
  statGrid: {
    flexDirection: "row",
    marginTop: spacing.sm + 4,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.soft,
  },
  statCell: { flex: 1, paddingVertical: spacing.sm + 3, paddingHorizontal: spacing.sm + 4 },
  statCellMiddle: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border },
  statLabel: { fontSize: 9, letterSpacing: 1.4, color: colors.textMuted, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  statValue: { ...typography.number, fontSize: 14, color: colors.ink, marginTop: spacing.xs },
  statValueWarn: { color: colors.danger },
  weeklyCard: { marginTop: spacing.sm + 4 },
  segmentError: { ...typography.caption, color: colors.danger, marginTop: spacing.xs },
});
