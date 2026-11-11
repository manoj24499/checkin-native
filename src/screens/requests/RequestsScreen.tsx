import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useFocusEffect, useRoute, type RouteProp } from "@react-navigation/native";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  Screen,
  Button,
  BottomSheet,
  Card,
  StatusBadge,
  EmptyState,
  LoadingView,
  SegmentedControl,
  Rise,
  Kicker,
  ScreenTitle,
  useReducedMotion,
} from "@/components/ui";
import { LeaveRequestSheet } from "./LeaveRequestSheet";
import { PermissionRequestSheet } from "./PermissionRequestSheet";
import { OvertimeRequestSheet } from "./OvertimeRequestSheet";
import {
  useLeaveRequests,
  useHolidays,
  useCancelLeaveRequest,
  useTimedPermissions,
  useOvertimeStatus,
  useLateArrivals,
} from "@/hooks";
import { getErrorMessage } from "@/utils/errors";
import { colors, fontFamilies, gradientDirection, gradients, spacing, typography } from "@/theme";
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
  LateArrival,
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

/** Holiday date block tint (Requests.dc.html: rgba(239,108,0,.16)). */
const DATE_BLOCK_BG = "rgba(239,108,0,0.16)";
/** Mockup `fill` keyframe easing. */
const GROW_EASING = Easing.bezier(0.3, 0.7, 0.2, 1);
/** Stagger step for list cards (mockup: .28s, .34s, .40s…). */
const ITEM_STEP = 60;
const MAX_STAGGER = 8;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
function formatDateWithWeekday(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function stagger(base: number, i: number) {
  return base + Math.min(i, MAX_STAGGER) * ITEM_STEP;
}

/**
 * Balance track with the mockup's `fill` keyframe: the gradient bar grows from 0 to its width (1.2s,
 * cubic-bezier(.3,.7,.2,1), .4s delay). scaleX from the left edge so it stays on the native driver.
 */
function GrowBar({ pct }: { pct: number }) {
  const reduced = useReducedMotion();
  const v = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) {
      v.setValue(1);
      return;
    }
    const a = Animated.timing(v, {
      toValue: 1,
      duration: 1200,
      delay: 400,
      easing: GROW_EASING,
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);
  return (
    <View style={styles.track}>
      <Animated.View
        style={[
          styles.trackFill,
          { width: `${Math.max(0, Math.min(100, pct))}%`, transformOrigin: "left", transform: [{ scaleX: v }] },
        ]}
      >
        <LinearGradient
          pointerEvents="none"
          colors={gradients.orange}
          start={gradientDirection.horizontal.start}
          end={gradientDirection.horizontal.end}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

/** One white request card (radius 20, padding 10/16, gap 3). */
function RequestCard({ delay, children }: { delay: number; children: ReactNode }) {
  return (
    <Rise delay={delay}>
      <Card size="sm" style={styles.rq}>
        {children}
      </Card>
    </Rise>
  );
}

/** White CTA card used on the Permission / Overtime tabs (same shape as the leave balance card). */
function ActionCard({
  kicker,
  title,
  body,
  cta,
  onPress,
}: {
  kicker: string;
  title: string;
  body: string;
  cta: string;
  onPress: () => void;
}) {
  return (
    <Rise delay={160}>
      <Card size="sm" style={styles.balanceCard}>
        <Kicker>{kicker}</Kicker>
        <View style={{ gap: 4 }}>
          <Text style={styles.ctaTitle}>{title}</Text>
          <Text style={styles.ctaBody}>{body}</Text>
        </View>
        <Button label={`+ ${cta}`} onPress={onPress} pulse style={styles.cta} labelStyle={styles.ctaLabel} />
      </Card>
    </Rise>
  );
}

function ListKicker({ delay, children }: { delay: number; children: string }) {
  return (
    <Rise delay={delay}>
      <Kicker style={styles.listKicker}>{children}</Kicker>
    </Rise>
  );
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
  const lateArrivalsQuery = useLateArrivals(true);

  // This tab stays mounted, so without this an admin's approval only shows up on the next 30 s poll
  // (and pull-to-refresh used to reload leave only). Refresh everything whenever the tab is opened.
  const refetchAll = () =>
    Promise.all([
      leaveQuery.refetch(),
      permissionsQuery.refetch(),
      overtimeQuery.refetch(),
      lateArrivalsQuery.refetch(),
    ]);
  const refetchAllRef = useRef(refetchAll);
  refetchAllRef.current = refetchAll;
  useFocusEffect(
    useCallback(() => {
      void refetchAllRef.current();
    }, []),
  );
  const refreshing =
    leaveQuery.isRefetching || permissionsQuery.isRefetching || overtimeQuery.isRefetching || lateArrivalsQuery.isRefetching;

  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const balances = leaveQuery.data?.balances ?? [];
  const leaveRequests = leaveQuery.data?.requests ?? [];
  const pendingLeaveCount = leaveRequests.filter((r) => r.status === "PENDING").length;
  const todayKey = new Date().toISOString().slice(0, 10);
  const upcomingHolidays = (holidaysQuery.data ?? []).filter((h: PublicHoliday) => h.date.slice(0, 10) >= todayKey);

  const permissions = permissionsQuery.data ?? [];
  const overtimeRequests = overtimeQuery.data ?? [];
  const lateArrivals = lateArrivalsQuery.data ?? [];

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

  const holidayBase = stagger(280, leaveRequests.length) + 60;

  return (
    <Screen
      scroll
      glow="topLeft"
      contentStyle={styles.content}
      onRefresh={() => void refetchAll()}
      refreshing={refreshing}
    >
      <Rise>
        <View accessibilityRole="header">
          <Kicker>Time off & approvals</Kicker>
          <ScreenTitle style={styles.pageTitle}>Requests</ScreenTitle>
        </View>
      </Rise>

      <Rise delay={80}>
        <SegmentedControl
          options={TABS.map((t) => ({ key: t.id, label: t.label, badge: t.badge }))}
          value={tab}
          onChange={setTab}
        />
      </Rise>

      {tab === "leave" ? (
        <>
          {leaveQuery.isLoading ? (
            <LoadingView label="Loading your leave…" />
          ) : (
            <>
              <Rise delay={160}>
                <Card size="sm" style={styles.balanceCard}>
                  <Kicker>This year</Kicker>
                  <View style={styles.balRow}>
                    {balances.map((b) => (
                      <View key={b.type} style={styles.bal}>
                        <Text style={styles.balLabel}>{TYPE_LABEL[b.type].toUpperCase()}</Text>
                        <Text style={styles.balValue} numberOfLines={1} adjustsFontSizeToFit>
                          {b.remaining} / {b.quota}
                        </Text>
                        <GrowBar pct={b.quota > 0 ? (b.remaining / b.quota) * 100 : 0} />
                      </View>
                    ))}
                  </View>
                  <Button
                    label="+ Request leave"
                    onPress={() => setSheet("leave")}
                    pulse
                    style={styles.cta}
                    labelStyle={styles.ctaLabel}
                  />
                </Card>
              </Rise>

              <ListKicker delay={220}>Your requests</ListKicker>
              {cancelError ? <Text style={styles.errorText}>{cancelError}</Text> : null}
              {leaveRequests.length === 0 ? (
                <Rise delay={280}>
                  <EmptyState title="Nothing here yet" message="Requests you submit show up here." />
                </Rise>
              ) : (
                leaveRequests.map((r: TimeOffRequest, i) => {
                  const rangeLabel =
                    r.startDate === r.endDate
                      ? formatDate(r.startDate)
                      : `${formatDate(r.startDate)} – ${formatDate(r.endDate)}`;
                  return (
                    <RequestCard key={r.id} delay={stagger(280, i)}>
                      <View style={styles.rqHead}>
                        <Text style={styles.rqTitle}>{TYPE_LABEL[r.type]}</Text>
                        <StatusBadge label={LEAVE_STATUS_LABEL[r.status]} tone={LEAVE_STATUS_TONE[r.status]} />
                      </View>
                      <Text style={styles.rqMeta}>
                        {rangeLabel} · {r.days} day{r.days === 1 ? "" : "s"}
                      </Text>
                      {r.status === "REJECTED" && r.reviewNote ? (
                        <Text style={[styles.rqMeta, styles.reviewNote]}>“{r.reviewNote}”</Text>
                      ) : null}
                      {r.status === "PENDING" ? (
                        <Pressable
                          onPress={() => handleCancelLeave(r.id)}
                          disabled={cancellingId === r.id}
                          accessibilityRole="button"
                          hitSlop={{ top: 10, bottom: 10 }}
                          style={styles.cancelBtn}
                        >
                          <Text style={styles.cancelLink}>
                            {cancellingId === r.id ? "Cancelling…" : "Cancel request"}
                          </Text>
                        </Pressable>
                      ) : null}
                    </RequestCard>
                  );
                })
              )}

              <ListKicker delay={holidayBase - 40}>Upcoming holidays · not deducted</ListKicker>
              {upcomingHolidays.length === 0 ? (
                <Rise delay={holidayBase}>
                  <EmptyState title="No upcoming holidays" message="None added for the rest of this year yet." />
                </Rise>
              ) : (
                upcomingHolidays.map((h, i) => {
                  const d = new Date(h.date);
                  return (
                    <Rise key={h.id} delay={stagger(holidayBase, i)}>
                      <Card size="sm" style={styles.holiday}>
                        <View style={styles.dateBlock}>
                          <Text style={styles.dateMonth}>
                            {d.toLocaleDateString(undefined, { month: "short" }).toUpperCase()}
                          </Text>
                          <Text style={styles.dateDay}>{d.getDate()}</Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.holidayName}>{h.name}</Text>
                          <Text style={styles.rqMeta}>{d.toLocaleDateString(undefined, { weekday: "long" })}</Text>
                        </View>
                      </Card>
                    </Rise>
                  );
                })
              )}
            </>
          )}
        </>
      ) : null}

      {tab === "permission" ? (
        <>
          <ActionCard
            kicker="Today"
            title="Pause my work time"
            body="Pause your work time for a few hours today. It won't count as outside time."
            cta="Request permission"
            onPress={() => setSheet("permission")}
          />

          <ListKicker delay={220}>Permission windows</ListKicker>
          {permissions.length === 0 ? (
            <Rise delay={280}>
              <EmptyState title="Nothing here yet" message="Requests you submit show up here." />
            </Rise>
          ) : (
            permissions.map((p: TimedPermission, i) => (
              <RequestCard key={p.id} delay={stagger(280, i)}>
                <View style={styles.rqHead}>
                  <Text style={styles.rqTitle}>
                    {formatTime(p.startTime)} – {formatTime(p.endTime)}
                  </Text>
                  <StatusBadge label={PERMISSION_STATUS_LABEL[p.status]} tone={PERMISSION_STATUS_TONE[p.status]} />
                </View>
                <Text style={styles.rqMeta}>{formatDateWithWeekday(p.startTime)}</Text>
              </RequestCard>
            ))
          )}
        </>
      ) : null}

      {tab === "overtime" ? (
        <>
          <ActionCard
            kicker="After hours"
            title="Staying past shift end?"
            body="Ask before your shift ends so the extra time counts."
            cta="Request overtime"
            onPress={() => setSheet("overtime")}
          />

          <ListKicker delay={220}>Overtime</ListKicker>
          {overtimeRequests.length === 0 ? (
            <Rise delay={280}>
              <EmptyState title="Nothing here yet" message="Requests you submit show up here." />
            </Rise>
          ) : (
            overtimeRequests.map((r: OvertimeRequest, i) => (
              <RequestCard key={r.id} delay={stagger(280, i)}>
                <View style={styles.rqHead}>
                  <Text style={styles.rqTitle}>Until ~{formatTime(r.estimatedEndAt)}</Text>
                  <StatusBadge label={OVERTIME_STATUS_LABEL[r.status]} tone={OVERTIME_STATUS_TONE[r.status]} />
                </View>
                <Text style={styles.rqMeta}>{r.reason}</Text>
              </RequestCard>
            ))
          )}
          {lateArrivals.length > 0 ? (
            <>
              <ListKicker delay={stagger(280, overtimeRequests.length) + 20}>Late arrivals</ListKicker>
              {lateArrivals.map((a: LateArrival, i) => (
                <RequestCard key={a.id} delay={stagger(stagger(280, overtimeRequests.length) + 80, i)}>
                  <View style={styles.rqHead}>
                    <Text style={styles.rqTitle}>{formatDateWithWeekday(a.timestamp)}</Text>
                    <StatusBadge
                      label={a.leaveType === "HALF_DAY" ? "Half-day leave" : "Permission"}
                      tone={a.leaveType === "HALF_DAY" ? "danger" : "warning"}
                    />
                  </View>
                  <Text style={styles.rqMeta}>
                    In {formatTime(a.timestamp)}
                    {a.lateMinutes ? ` · ${a.lateMinutes} min late` : ""}
                  </Text>
                </RequestCard>
              ))}
            </>
          ) : null}
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
      <BottomSheet visible={sheet === "overtime"} onClose={() => setSheet(null)} kicker="TODAY" title="Request overtime">
        <OvertimeRequestSheet onDone={() => setSheet(null)} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.gutter, paddingTop: 8, gap: 9 },
  pageTitle: { fontSize: 26, lineHeight: 32 },
  balanceCard: { paddingVertical: 12, paddingHorizontal: 16, gap: 8 },
  balRow: { flexDirection: "row", gap: 14 },
  bal: { flex: 1, minWidth: 0 },
  balLabel: { ...typography.statLabel, color: colors.textSecondary },
  balValue: { ...typography.number, fontSize: 20, color: colors.ink, marginTop: 4, marginBottom: 8 },
  track: { height: 5, borderRadius: 3, backgroundColor: "rgba(23,19,15,0.12)", overflow: "hidden" },
  trackFill: { height: 5, borderRadius: 3, overflow: "hidden" },
  cta: { minHeight: 48, borderRadius: 24 },
  ctaLabel: { fontSize: 15 },
  ctaTitle: { ...typography.section, color: colors.ink },
  ctaBody: { fontSize: 13, lineHeight: 18, fontFamily: fontFamilies.regular, color: colors.textSecondary },
  listKicker: { marginTop: 2, marginBottom: 0 },
  errorText: { fontSize: 13, fontFamily: fontFamilies.regular, color: colors.danger },
  rq: { paddingVertical: 10, paddingHorizontal: 16, gap: 3 },
  rqHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  rqTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    fontFamily: fontFamilies.semiBold,
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
  rqMeta: { fontSize: 12, fontFamily: fontFamilies.regular, color: colors.textSecondary, fontVariant: ["tabular-nums"] },
  reviewNote: { fontStyle: "italic" },
  cancelBtn: { alignSelf: "flex-start", paddingTop: 4 },
  cancelLink: { fontSize: 13, fontWeight: "500", fontFamily: fontFamilies.medium, color: colors.danger },
  holiday: { paddingVertical: 12, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 14 },
  dateBlock: { width: 44, alignItems: "center", borderRadius: 12, backgroundColor: DATE_BLOCK_BG, paddingVertical: 6 },
  dateMonth: { fontSize: 10, fontWeight: "600", fontFamily: fontFamilies.semiBold, color: colors.accentText },
  dateDay: { ...typography.number, fontSize: 18, color: colors.ink },
  holidayName: { fontSize: 14, fontWeight: "600", fontFamily: fontFamilies.semiBold, color: colors.ink },
});
