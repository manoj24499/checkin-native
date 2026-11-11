import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  Screen,
  LoadingView,
  ErrorView,
  Card,
  AvatarBadge,
  IconButton,
  Kicker,
  ListRow,
  Rise,
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
  HybridSegmentCard,
  HybridArrivalPrompt,
  FieldVisitCard,
  AssignedPlacesCard,
  LeaveBalanceCard,
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
  useNotifications,
  useHybridTargets,
} from "@/hooks";
import { useHybridPromptStore } from "@/store/hybridPromptStore";
import { useAttendanceSessionStore } from "@/store/attendanceSessionStore";
import { startLocationTracking } from "@/services/locationTracking";
import { formatDuration, groupAttendanceByDay } from "@/utils/attendanceGrouping";
import { getErrorMessage, isNetworkError } from "@/utils/errors";
import { formatDistance } from "@/utils/geo";
import { colors, spacing, typography } from "@/theme";
import type { AppTabParamList, DashboardStackParamList } from "@/navigation/types";
import { useTabBarClearance } from "@/navigation/tabBarClearance";
import type { HybridPlace, WorkSegmentMode, WorkSegmentSwitchRequest } from "@/types";

type Nav = NativeStackNavigationProp<DashboardStackParamList, "DashboardHome">;

function formatTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatShiftTime(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

const WORK_MODE_LABEL: Record<string, string> = {
  OFFICE: "Office",
  WFH: "Home",
  FIELD: "Anywhere",
  HYBRID: "Hybrid",
};

const HYBRID_SEGMENT_LABEL: Record<string, string> = { OFFICE: "Office", HOME: "Home", TRANSIT: "Transit" };

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function DashboardScreen() {
  const tabClearance = useTabBarClearance();
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
  const isHybrid = user?.workMode === "HYBRID";
  const segmentQuery = useWorkSegment(hasActiveSession && (isFieldWorker || isHybrid));
  const hybridStatus = isHybrid && statusQuery.data?.exists ? (statusQuery.data.hybrid ?? null) : null;
  // The polled work-segment is the freshest; status.segment covers its first load.
  const hybridSegment =
    isHybrid && hasActiveSession
      ? (segmentQuery.data ?? (statusQuery.data?.exists ? (statusQuery.data.segment ?? null) : null))
      : null;
  const hybridTargets = useHybridTargets(hybridStatus);
  const departure = useHybridPromptStore((s) => s.departure);
  const switchSegment = useSwitchWorkSegment();
  // Same query (and key) FieldVisitCard already polls while a Field session
  // is open — read here for the hero's distance and visit count.
  const fieldSummaryQuery = useFieldSummary(hasActiveSession && isFieldWorker);
  // Same query LeaveBalanceCard / the Requests tab dot use — drives the
  // bell's dot (pending leave requests).
  const leaveQuery = useLeaveRequests();
  const { unreadCount: unreadNotifications } = useNotifications();
  // A WFH employee who chose Office today (see CheckInOutScreen's Home/
  // Office picker) needs the RANGE stat and PresenceCard geofenced against
  // the office too, not home — same reasoning as LiveMapScreen's identical
  // check.
  const isWfhOfficeDay =
    user?.workMode === "WFH" && statusQuery.data?.exists === true && statusQuery.data.checkInMode === "OFFICE";
  const resolvedTarget = useResolvedGeofenceTarget(isWfhOfficeDay ? "OFFICE" : undefined);
  // HYBRID: the current place (home during a HOME segment, the destination
  // while travelling), else the office.
  const hybridPlaceNow: HybridPlace | null =
    hybridSegment?.mode === "HOME" || hybridSegment?.mode === "OFFICE"
      ? hybridSegment.mode
      : hybridSegment?.mode === "TRANSIT"
        ? (hybridSegment.heading ?? null)
        : null;
  const target = isHybrid
    ? hybridPlaceNow === "HOME"
      ? hybridTargets.home
      : (hybridTargets.office ?? hybridTargets.home)
    : resolvedTarget;
  const geofence = useGeofence(target);

  // Drop push hints once the segment has moved on (switched, arrived, extended).
  const segmentMode = hybridSegment?.mode ?? null;
  const segmentExpired = !!hybridSegment?.transitExpired;
  useEffect(() => {
    if (!isHybrid || !segmentQuery.data) return;
    const store = useHybridPromptStore.getState();
    const atPlace = segmentMode === "OFFICE" || segmentMode === "HOME";
    if (store.departure && (!atPlace || store.departure.suggestedHeading === segmentMode)) store.clearDeparture();
    if (store.transitExpired && !(segmentMode === "TRANSIT" && segmentExpired)) store.clearTransitExpired();
  }, [isHybrid, segmentQuery.data, segmentMode, segmentExpired]);
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
  // Right after the app is reopened the status can still be loading (or the copy kept on the phone predates the
  // check-in), which used to leave the clock at 0 until a second refresh. While the status is being fetched, fall
  // back to the open check-in in today's history so the clock keeps running from the real check-in time.
  const provisionalCheckInAt =
    !sessionOpen && !checkedOut && statusQuery.isFetching ? (activeCheckIn?.timestamp ?? null) : null;

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
      : isHybrid && sessionOpen && segmentMode === "TRANSIT"
        ? geofence.distanceMeters !== null
          ? `${formatDistance(geofence.distanceMeters)} to go`
          : "Travelling"
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

  // HYBRID: switch to TRANSIT, arrive, or extend the transit window.
  const handleHybridSegment = async (body: WorkSegmentSwitchRequest) => {
    setSegmentError(null);
    try {
      await switchSegment.mutateAsync(body);
      if ("mode" in body) useHybridPromptStore.getState().clearDeparture();
    } catch (error) {
      setSegmentError(
        isNetworkError(error)
          ? "You're offline — this needs a connection. Try again when you're back online."
          : getErrorMessage(error, "Couldn't update your place. Please try again."),
      );
    }
  };

  // HYBRID live worked time leaves travel out: what status counted so far,
  // plus the time since that fetch while a transit is still open.
  const statusSegment = statusQuery.data?.exists ? statusQuery.data.segment : null;
  const hybridTransit =
    isHybrid && sessionOpen && hybridStatus?.segmentMinutes
      ? {
          baseMs: hybridStatus.segmentMinutes.transitMinutes * 60_000,
          liveSince:
            statusSegment?.mode === "TRANSIT" && !isPaused && statusQuery.dataUpdatedAt > 0
              ? statusQuery.dataUpdatedAt
              : null,
        }
      : undefined;

  // ---- Hero (PresenceCard) inputs ----
  const showFieldVisit = sessionOpen && isFieldWorker;
  const fieldSummary = fieldSummaryQuery.data;
  const fieldActive = showFieldVisit && fieldSummary?.active === true;
  const fieldDay = status?.exists ? status.checkInMode !== "OFFICE" : true;
  const heroDistance = fieldActive && fieldDay && fieldSummary?.active ? fieldSummary.distanceMeters : null;
  const visitCount = fieldSummary?.active ? fieldSummary.visits.length : 0;

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
        { key: "leave", icon: "leave", label: "Leave", onPress: () => tabs()?.navigate("Requests", { tab: "leave" }) },
        {
          key: "permission",
          icon: "pause",
          label: "Permission",
          onPress: () => tabs()?.navigate("Requests", { tab: "permission" }),
        },
        { key: "history", icon: "historyClock", label: "History", onPress: goHistory },
      ]
    : [
        { key: "map", icon: "pin", label: "Map", onPress: () => tabs()?.navigate("Map") },
        { key: "leave", icon: "leave", label: "Leave", onPress: () => tabs()?.navigate("Requests", { tab: "leave" }) },
        {
          key: "permission",
          icon: "pause",
          label: "Permission",
          onPress: () => tabs()?.navigate("Requests", { tab: "permission" }),
        },
        { key: "history", icon: "historyClock", label: "History", onPress: goHistory },
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
  // Design: while a session is open, a muted "Check out" placeholder row
  // shows when the shift ends.
  const shiftEnd = status?.exists ? status.shiftEndTime : null;
  const showCheckOutPlaceholder = sessionOpen && !checkOutRecord;
  if (showCheckOutPlaceholder) todayRows.push("checkOutPending");
  const dividerFor = (key: string) => todayRows.indexOf(key) > 0;

  // Hero gauge: the shift scales the arc; a (non-declined) timed permission is drawn on it.
  const shift = status?.exists ? { start: status.shiftStartTime, end: status.shiftEndTime } : null;
  const gaugePermission =
    sessionOpen && currentPermission && currentPermission.status !== "rejected"
      ? { startTime: currentPermission.startTime, endTime: currentPermission.endTime }
      : null;
  // Today's bar in the 7-day chart while the session is still open.
  const liveToday =
    sessionOpen && checkInAt && status?.exists
      ? { checkInAt, pauses: status.pauses, excludeMs: hybridTransit?.baseMs }
      : null;

  return (
    <Screen contentStyle={styles.screenContent} tabBarClearance={false}>
      {/* Fixed top bar: stays put while the page scrolls underneath. */}
      <Rise style={styles.fixedHeader}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <AvatarBadge name={user?.name} size={44} pulse />
            <View style={styles.headerText}>
              <Kicker style={styles.greetingKicker}>{greeting()}</Kicker>
              <Text style={styles.greeting} numberOfLines={1}>
                {user?.name?.split(" ")[0] ?? "there"}
              </Text>
            </View>
          </View>
          <IconButton
            icon="bell"
            onPress={() => navigation.navigate("Notifications")}
            badge={unreadNotifications > 0}
            accessibilityLabel={unreadNotifications > 0 ? `Notifications, ${unreadNotifications} unread` : "Notifications"}
          />
        </View>
      </Rise>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: spacing.lg + tabClearance }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={statusQuery.isRefetching}
            onRefresh={() => statusQuery.refetch()}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        <Rise delay={100}>
          <PresenceCard
            isTracking={isTracking}
            checkInAt={sessionOpen ? checkInAt : provisionalCheckInAt}
            isPaused={sessionOpen ? isPaused : false}
            pauses={sessionOpen && status?.exists ? status.pauses : []}
            pauseReason={pauseReason}
            trackingWarning={trackingWarning}
            onEnableSharing={!isTracking && activeCheckIn ? handleEnableSharing : undefined}
            enablingSharing={enablingSharing}
            checkedIn={sessionOpen || !!provisionalCheckInAt}
            onPrimaryAction={goCheckInOut}
            pendingSync={!!effective.pendingCheckIn}
            distanceMeters={heroDistance}
            shift={shift}
            permission={gaugePermission}
            transit={hybridTransit}
            stats={{
              inAt: formatTime(checkInAt),
              mode: isFieldWorker
                ? segmentQuery.data?.mode === "OFFICE"
                  ? "Office"
                  : "Field"
                : isHybrid && sessionOpen && segmentMode
                  ? (HYBRID_SEGMENT_LABEL[segmentMode] ?? "Hybrid")
                  : WORK_MODE_LABEL[isWfhOfficeDay ? "OFFICE" : user?.workMode ?? "OFFICE"],
              range: rangeLabel,
              rangeWarn: geofence.withinRadius === false && !(isHybrid && segmentMode === "TRANSIT"),
            }}
            actions={heroActions}
          />
        </Rise>

        {sessionOpen && hybridSegment?.mode === "TRANSIT" && hybridSegment.transitExpired && hybridSegment.heading ? (
          <Rise>
            <HybridArrivalPrompt
              heading={hybridSegment.heading}
              busy={switchSegment.isPending}
              onArrived={() => {
                if (hybridSegment.heading) void handleHybridSegment({ mode: hybridSegment.heading });
              }}
              onStillTravelling={() => void handleHybridSegment({ extend: true })}
            />
          </Rise>
        ) : null}

        {!checkedIn && todayLeave ? (
          <Rise delay={200}>
            <LeaveNoticeCard type={todayLeave.type} />
          </Rise>
        ) : null}

        {todayRows.length > 0 ? (
          <Rise delay={250}>
            <Card style={styles.listCard}>
              <SectionHeader title="Today" actionLabel="History" onAction={goHistory} style={styles.listHeader} />
              {checkInAt ? (
                <ListRow
                  title="Checked in"
                  subtitle={`Today · ${formatTime(checkInAt)}`}
                  value={checkInValue}
                  valueTone={lateMinutes && lateMinutes > 0 ? lateTone : "success"}
                  valueSub={checkInSub}
                />
              ) : null}
              {checkOutRecord ? (
                <ListRow
                  title="Checked out"
                  subtitle={`Today · ${formatTime(checkOutRecord.timestamp)}`}
                  value={todaySummary?.durationMs != null ? formatDuration(todaySummary.durationMs) : undefined}
                  valueSub={todaySummary?.durationMs != null ? "worked" : undefined}
                  divider={dividerFor("checkOut")}
                />
              ) : null}
              {showCheckOutPlaceholder ? (
                <ListRow
                  muted
                  title="Check out"
                  subtitle={shiftEnd ? `Shift ends ${formatShiftTime(shiftEnd)}` : "Not yet"}
                  value="—"
                  valueTone="muted"
                  divider={dividerFor("checkOutPending")}
                />
              ) : null}
              {showPermissionRow && currentPermission ? (
                <PermissionStatusCard permission={currentPermission} asRow divider={dividerFor("permission")} />
              ) : null}
              {showOvertimeRow && currentOvertime ? (
                <OvertimeStatusCard request={currentOvertime} asRow divider={dividerFor("overtime")} />
              ) : null}
            </Card>
          </Rise>
        ) : null}

        {sessionOpen && isFieldWorker && (segmentQuery.data?.mode === "OFFICE" || segmentQuery.data?.mode === "FIELD") ? (
          <Rise delay={300}>
            <WorkSegmentCard
              mode={segmentQuery.data.mode}
              onSwitch={handleSwitchSegment}
              switching={switchSegment.isPending}
            />
            {segmentError ? <Text style={styles.segmentError}>{segmentError}</Text> : null}
          </Rise>
        ) : null}

        {sessionOpen && isHybrid && hybridSegment?.mode && hybridSegment.mode !== "FIELD" ? (
          <Rise delay={300}>
            <HybridSegmentCard
              segment={hybridSegment}
              segmentMinutes={hybridStatus?.segmentMinutes ?? null}
              isTracking={isTracking}
              suggestedHeading={departure?.suggestedHeading ?? null}
              onDismissSuggestion={() => useHybridPromptStore.getState().clearDeparture()}
              onSwitch={(heading) => void handleHybridSegment({ mode: "TRANSIT", heading })}
              onArrive={(place) => void handleHybridSegment({ mode: place })}
              busy={switchSegment.isPending}
              error={segmentError}
            />
          </Rise>
        ) : null}

        {isFieldWorker ? (
          <Rise delay={300}>
            <AssignedPlacesCard onOpen={() => navigation.navigate("TodaysPlaces")} />
          </Rise>
        ) : null}

        {showFieldVisit ? (
          // onLayout on the outer View: its y is relative to the scroll content (the hero's "Visit" tile scrolls here).
          <View onLayout={(e) => (fieldVisitY.current = e.nativeEvent.layout.y)}>
            <Rise delay={300}>
              <FieldVisitCard openSignal={visitSignal} />
            </Rise>
          </View>
        ) : null}

        <PendingSyncCard employeeCode={user?.employeeCode} />

        {leaveType !== "NONE" ? (
          <Rise delay={300}>
            <LateNoticeCard leaveType={leaveType} lateMinutes={lateMinutes} />
          </Rise>
        ) : null}

        <Rise delay={350}>
          <Card>
            <WeeklyHoursChart days={daySummaries} liveToday={liveToday} />
          </Card>
        </Rise>

        <Rise delay={450}>
          <LeaveBalanceCard onPress={() => tabs()?.navigate("Requests", { tab: "leave" })} />
        </Rise>

        {isFieldWorker ? (
          <Rise delay={500}>
            <ReimbursementCard />
          </Rise>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: { padding: 0 },
  scrollContent: { flexGrow: 1, paddingHorizontal: spacing.gutter, paddingTop: spacing.sm, gap: spacing.md },
  fixedHeader: { paddingHorizontal: spacing.gutter, paddingTop: 12, paddingBottom: spacing.sm },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 0 },
  headerText: { flex: 1, minWidth: 0 },
  greetingKicker: { marginBottom: 0 },
  greeting: { ...typography.h2, lineHeight: 28, color: colors.ink },
  listCard: { paddingVertical: 6, paddingHorizontal: 16 },
  listHeader: { marginTop: 0, marginBottom: 0, marginHorizontal: 0, paddingTop: 10, paddingBottom: 2 },
  segmentError: { ...typography.caption, color: colors.danger, marginTop: spacing.xs },
});
