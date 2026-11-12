import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigation } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useNetInfo } from "@react-native-community/netinfo";
import { Animated, Image, Pressable, StyleSheet, Text, View } from "react-native";
import {
  Screen,
  Card,
  Button,
  TextField,
  LoadingView,
  ErrorView,
  StatusBadge,
  IssueDialog,
  Icon,
  IconTile,
  Kicker,
  ScreenTitle,
  SegmentedControl,
  GlowPanel,
  PulseRing,
  Rise,
  useLoop,
  useReducedMotion,
  loopEasing,
} from "@/components/ui";
import { OvertimeStatusCard } from "@/components/dashboard";
import { PhotoCaptureView } from "@/components/camera";
import { SlideToConfirmTrack, PinBoxInput } from "@/components/checkin";
import {
  useAuth,
  useEffectiveAttendanceStatus,
  useResolvedGeofenceTarget,
  useGeofence,
  useCheckInOut,
  useSaveOfflineAttempt,
  useTimedPermissions,
  useOvertimeStatus,
  useTodayLeave,
  useHybridTargets,
} from "@/hooks";
import { useCheckInDraftStore } from "@/store/checkInDraftStore";
import { useTrackingFixStore } from "@/store/trackingFixStore";
import { checkTrackingReadiness } from "@/services/trackingReadiness";
import { checkPinLocally } from "@/services/pinVerifier";
import { syncOfflineQueue } from "@/services/offlineQueue";
import { useOfflineQueueStore } from "@/store/offlineQueueStore";
import { getErrorMessage, isNetworkError } from "@/utils/errors";
import { checkHybridPlace, formatDistance } from "@/utils/geo";
import { colors, fontFamilies, radius, spacing, typography } from "@/theme";
import type { AttendanceAction, CheckInMode, ScanRequest, TimeOffType } from "@/types";

const TYPE_LABEL: Record<TimeOffType, string> = {
  CASUAL: "Casual",
  SICK: "Sick",
  EARNED: "Earned",
};

const SERVER_NOTE = "The server re-checks your PIN, photo and distance before it counts.";

function fmtShift(hhmm: string | null | undefined) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function fmtTime(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function todayLabel() {
  return new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" });
}

export function CheckInOutScreen() {
  const { user } = useAuth();
  // Server status plus anything saved offline and not yet sent (see
  // useEffectiveAttendanceStatus) — a queued check-in makes this screen the
  // check-out form. `statusQuery` stays the raw server query.
  const effective = useEffectiveAttendanceStatus(user?.employeeCode);
  const statusQuery = effective.query;
  // See DashboardScreen's identical comment — must stay unconditional, so it
  // can't wait for the loading/error guards below to compute `status` first.
  const hasActiveSession = statusQuery.data?.exists
    ? statusQuery.data.checkedIn && !statusQuery.data.checkedOut
    : false;
  const permissionsQuery = useTimedPermissions(hasActiveSession);
  const overtimeQuery = useOvertimeStatus(hasActiveSession);
  const todayLeave = useTodayLeave();
  const checkInOut = useCheckInOut();
  const saveOffline = useSaveOfflineAttempt();
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  // Offline check-in: only when the organization allows it (the last status
  // fetched for this employee said so — see services/offlineQueue.ts).
  // Otherwise being offline behaves exactly as before.
  const netInfo = useNetInfo();
  const isOffline = netInfo.isConnected === false;
  const offlineConfig = useOfflineQueueStore((s) => s.config);
  const offlineEnabled = !!user && offlineConfig?.employeeCode === user.employeeCode && offlineConfig.enabled;
  const offlineMode = isOffline && offlineEnabled;
  // Anything of this employee's still waiting to be sent: a new attempt must
  // queue up behind it even when online, or e.g. an online check-out could
  // reach the server before the offline check-in it depends on.
  const hasQueuedItems = useOfflineQueueStore((s) =>
    s.items.some((i) => i.employeeCode === user?.employeeCode && (i.status === "pending" || i.status === "syncing")),
  );
  // Set right after an attempt was saved on the phone — shows the "saved"
  // confirmation in place of the form until dismissed.
  const [savedOffline, setSavedOffline] = useState<{
    action: AttendanceAction;
    pinUnverified: boolean;
    // Online, but queued behind earlier unsent items — sent right away.
    sendingNow: boolean;
  } | null>(null);
  const [offlineIssue, setOfflineIssue] = useState<{ title: string; body: string } | null>(null);

  const [pin, setPin] = useState("");
  // Vehicle odometer reading (km) — asked for on Field sessions only: start
  // reading at check-in, end reading at check-out.
  const [odometer, setOdometer] = useState("");
  const [issueOpen, setIssueOpen] = useState(false);
  const photoDataUrl = useCheckInDraftStore((s) => s.photoDataUrl);
  const setPhotoDataUrl = useCheckInDraftStore((s) => s.setPhotoDataUrl);
  // Which photo the camera screen is currently capturing for — the presence
  // photo (required whenever requiresPhoto) or the optional overtime work
  // summary photo (only ever shown on a CHECK_OUT with an active overtime
  // request). One camera flow, two possible destinations.
  const [cameraTarget, setCameraTarget] = useState<"presence" | "overtime" | null>(null);
  const [overtimeSummary, setOvertimeSummary] = useState("");
  const [overtimeSummaryPhotoDataUrl, setOvertimeSummaryPhotoDataUrl] = useState<string | null>(null);

  // Field-workMode employees pick Office/Field for the day right here,
  // before checking in — defaults to Field (the only choice that existed
  // before this picker). Irrelevant, and never read, for OFFICE/WFH.
  const [fieldCheckInMode, setFieldCheckInMode] = useState<CheckInMode>("FIELD");
  const isFieldEmployee = user?.workMode === "FIELD";

  // WFH-workMode employees get the equivalent Home/Office choice — defaults
  // to Home (the only behavior that existed before this picker). "HOME"
  // never leaves this screen: it just means "don't override", same as
  // omitting checkInMode entirely (see CheckInMode's comment in @/types).
  const [wfhCheckInMode, setWfhCheckInMode] = useState<"HOME" | "OFFICE">("HOME");
  const isWfhEmployee = user?.workMode === "WFH";

  const dayOverrideMode: CheckInMode | undefined = isFieldEmployee
    ? fieldCheckInMode
    : isWfhEmployee && wfhCheckInMode === "OFFICE"
      ? "OFFICE"
      : undefined;

  // HYBRID employees can start the day at the office OR at home: the
  // position is checked against both (office first, like the server) and
  // checkInMode is omitted so the server decides which place it was.
  const isHybridEmployee = user?.workMode === "HYBRID";
  const hybridTargets = useHybridTargets(statusQuery.data?.exists ? statusQuery.data.hybrid : null);

  const resolvedTarget = useResolvedGeofenceTarget(dayOverrideMode);
  // For HYBRID this target only drives reading the position (and is what
  // makes the geofence panel show); the in-range decision uses both places.
  const target = isHybridEmployee ? (hybridTargets.office ?? hybridTargets.home) : resolvedTarget;
  const geofence = useGeofence(target);
  const hybridCheck =
    isHybridEmployee && geofence.coords && !geofence.mocked && !geofence.error
      ? checkHybridPlace(geofence.coords, hybridTargets.office, hybridTargets.home)
      : null;
  // Same meaning as geofence.withinRadius: true inside, false clearly
  // outside, null unknown. For HYBRID "clearly outside" needs both places
  // known — outside the one we know about says nothing about the other.
  const withinRadius = isHybridEmployee
    ? hybridCheck
      ? hybridCheck.place !== null
        ? true
        : hybridTargets.office && hybridTargets.home
          ? false
          : null
      : null
    : geofence.withinRadius;
  const shownDistance = isHybridEmployee
    ? hybridCheck
      ? hybridCheck.place === "OFFICE"
        ? hybridCheck.officeDistance
        : hybridCheck.place === "HOME"
          ? hybridCheck.homeDistance
          : (hybridCheck.nearest?.distance ?? null)
      : null
    : geofence.distanceMeters;

  // Offline there may be no target to measure against (the office location is
  // only cached in memory), so useGeofence never reads the position on its own
  // — but a saved check-in still needs one for the server to check later.
  const needsOfflinePosition = offlineMode && !target && !geofence.coords && !geofence.isLoading && !geofence.error;
  useEffect(() => {
    if (needsOfflinePosition) void geofence.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsOfflinePosition]);

  if (savedOffline) {
    return (
      <EndState
        icon={<DoneBadge />}
        badge={<StatusBadge label="Pending sync" tone="warning" />}
        title={savedOffline.action === "CHECK_IN" ? "Check-in saved" : "Check-out saved"}
        meta={todayLabel()}
        footer={
          <Button
            label="Go to Dashboard"
            variant="primary"
            onPress={() => {
              setSavedOffline(null);
              navigation.navigate("Dashboard" as never);
            }}
          />
        }
      >
        <GlowPanel style={styles.endPanel}>
          <Text style={styles.endPanelKicker}>SAVED ON THIS PHONE</Text>
          <Text style={styles.endPanelBody}>
            {savedOffline.sendingNow
              ? "Sending now, right after your earlier offline check-in."
              : "It will be sent automatically when you're back online."}
          </Text>
          {savedOffline.pinUnverified ? (
            <Text style={styles.endPanelMuted}>
              Your PIN couldn't be checked offline — it's verified when it's sent.
            </Text>
          ) : null}
        </GlowPanel>
      </EndState>
    );
  }

  if (effective.isLoading) return <LoadingView label="Checking today's status…" />;
  if (effective.isError) {
    return <ErrorView message={getErrorMessage(statusQuery.error)} onRetry={() => statusQuery.refetch()} />;
  }

  const status = effective.data;
  const checkedIn = status?.exists ? status.checkedIn : false;
  const checkedOut = status?.exists ? status.checkedOut : false;

  if (checkedIn && checkedOut) {
    const inAt = status?.exists ? fmtTime(status.checkInAt) : null;
    const doneShiftStart = status?.exists ? fmtShift(status.shiftStartTime) : null;
    const doneShiftEnd = status?.exists ? fmtShift(status.shiftEndTime) : null;
    const pendingSync = effective.pendingCheckIn || effective.pendingCheckOut;
    return (
      <EndState
        icon={<DoneBadge />}
        badge={pendingSync ? <StatusBadge label="Pending sync" tone="warning" /> : null}
        title="You're checked out"
        meta={todayLabel()}
        footer={<Button label="Back to Home" onPress={() => navigation.navigate("Dashboard" as never)} />}
      >
        <GlowPanel style={styles.endPanel}>
          <Text style={styles.endPanelKicker}>{inAt ? "CHECKED IN AT" : "TODAY"}</Text>
          <Text style={styles.endPanelValue}>{inAt ?? "All done"}</Text>
          <Text style={styles.endPanelMuted}>
            {pendingSync
              ? "Saved on this device. Will be sent when you're back online."
              : doneShiftStart && doneShiftEnd
                ? `Checked out · shift ${doneShiftStart} – ${doneShiftEnd}`
                : "You've already checked in and out today."}
          </Text>
        </GlowPanel>
      </EndState>
    );
  }

  // Check-in is blocked server-side on an approved leave day (see
  // /api/kiosk/scan) — show this instead of a form that would just fail.
  // Check-out is left alone: if they already checked in before leave was
  // approved, they still need to be able to close their day out normally.
  if (!checkedIn && todayLeave) {
    return (
      <EndState
        icon={<IconTile icon="calendar" tone="success" size={96} radius={48} />}
        title="You're on leave today"
        meta={`Your ${TYPE_LABEL[todayLeave.type]} leave request for today was approved — check-in is disabled.`}
        footer={<Button label="Back to Home" onPress={() => navigation.navigate("Dashboard" as never)} />}
      />
    );
  }

  const action = checkedIn ? "CHECK_OUT" : "CHECK_IN";
  const isPaused = status?.exists ? status.isPaused : false;
  const currentPermission = hasActiveSession
    ? (permissionsQuery.data ?? []).find((p) => p.status !== "resolved") ?? null
    : null;
  const isPermissionPause = currentPermission?.status === "active";
  const currentOvertime = hasActiveSession
    ? (overtimeQuery.data ?? []).find((r) => r.active) ?? null
    : null;
  const showOvertimeSummary = action === "CHECK_OUT" && !!currentOvertime;
  const checkOutPhotoRequired = status?.exists ? status.checkOutPhotoRequired : false;
  // Only shown before check-in — once checked in, today's choice is locked
  // in (see status.checkInMode) and re-showing the picker would be misleading.
  const showFieldPicker = isFieldEmployee && action === "CHECK_IN";
  const showHomePicker = isWfhEmployee && action === "CHECK_IN";
  const requiresPhoto = action === "CHECK_IN" || (action === "CHECK_OUT" && checkOutPhotoRequired);
  const requiresGeofence = action === "CHECK_IN" && !!target;

  const needsOdometer =
    isFieldEmployee &&
    ((action === "CHECK_IN" && fieldCheckInMode === "FIELD") ||
      (action === "CHECK_OUT" && status?.exists === true && status.checkInMode === "FIELD"));
  const odometerValue = Number(odometer.replace(/,/g, "").trim());
  const odometerValid = odometer.trim() !== "" && Number.isFinite(odometerValue) && odometerValue >= 0;

  // Offline the distance check stays advisory exactly like online, but only a
  // clear "outside" blocks — the cached target may be stale, and the server
  // re-checks (and flags, rather than rejects) on upload. A position is still
  // needed for any check-in the server geofences (everything but a Field day),
  // and a mocked one would only be rejected later.
  const needsOfflineCoords = action === "CHECK_IN" && !(isFieldEmployee && fieldCheckInMode === "FIELD");
  const locationOk = offlineMode
    ? withinRadius !== false && !geofence.mocked && (!needsOfflineCoords || !!geofence.coords)
    : !requiresGeofence || withinRadius === true;

  const canSubmit =
    pin.length >= 4 &&
    (!needsOdometer || odometerValid) &&
    (!requiresPhoto || !!photoDataUrl) &&
    locationOk;

  // Field days and HYBRID employees (whose office/home switches are detected
  // from location pings): before checking in, make sure the phone will actually keep recording the
  // route (location "all the time" + no battery restriction). If not, show the fix-it sheet
  // first; the employee can still check in anyway from there.
  const handleSubmit = async () => {
    if (!user) return;
    if (action === "CHECK_IN" && (needsOdometer || isHybridEmployee)) {
      const readiness = await checkTrackingReadiness();
      if (!readiness.ok) {
        useTrackingFixStore.getState().show(() => void submitCheckIn());
        return;
      }
    }
    await submitCheckIn();
  };

  const resetForm = () => {
    setPin("");
    setOdometer("");
    setPhotoDataUrl(null);
    setOvertimeSummary("");
    setOvertimeSummaryPhotoDataUrl(null);
  };

  // Offline path: check the PIN against the local verifier (see
  // services/pinVerifier.ts), then save the attempt on the phone.
  const saveAttemptOffline = async (payload: ScanRequest, sendingNow = false) => {
    const check = await checkPinLocally(payload.employeeCode, payload.pin);
    if (check.result === "wrong" || check.result === "locked") {
      setPin("");
      setOfflineIssue(
        check.result === "wrong"
          ? {
              title: "Wrong PIN",
              body: `That PIN doesn't match. ${check.attemptsLeft} ${check.attemptsLeft === 1 ? "try" : "tries"} left before you'll need to connect to the internet.`,
            }
          : { title: "Too many wrong PINs", body: "Connect to the internet to continue." },
      );
      return;
    }
    try {
      await saveOffline.save({ payload, pinUnverified: check.result === "unverified" });
      resetForm();
      setSavedOffline({ action: payload.action, pinUnverified: check.result === "unverified", sendingNow });
      if (sendingNow) void syncOfflineQueue();
    } catch (error) {
      setOfflineIssue({ title: "Couldn't save on this phone", body: getErrorMessage(error) });
    }
  };

  const submitCheckIn = async () => {
    if (!user) return;
    const payload: ScanRequest = {
      employeeCode: user.employeeCode,
      pin,
      action,
      photo: photoDataUrl ?? undefined,
      latitude: geofence.coords?.latitude,
      longitude: geofence.coords?.longitude,
      mocked: geofence.mocked,
      checkInMode: dayOverrideMode,
      odometerKm: needsOdometer ? odometerValue : undefined,
      // Never required to check out — see the optional summary section
      // below and the schema comment on ScanRequest.overtimeSummary.
      overtimeSummary: showOvertimeSummary ? overtimeSummary.trim() || undefined : undefined,
      overtimeSummaryPhoto: showOvertimeSummary ? overtimeSummaryPhotoDataUrl ?? undefined : undefined,
    };
    if (offlineMode || (offlineEnabled && hasQueuedItems)) {
      await saveAttemptOffline(payload, !isOffline);
      return;
    }
    try {
      await checkInOut.mutateAsync(payload);
      resetForm();
      // After checking in, land on the Dashboard rather than leaving the
      // employee on the (now "check out") form.
      if (action === "CHECK_IN") navigation.navigate("Dashboard" as never);
    } catch (error) {
      // "Connected" but the request never reached the server (dead Wi-Fi,
      // captive portal, signal lost mid-request): save it instead. If the
      // server did get it and only the reply was lost, the later upload comes
      // back "already checked in" and shows as Already recorded.
      if (offlineEnabled && isNetworkError(error)) {
        await saveAttemptOffline(payload);
        return;
      }
      // The server says it already has today's check-in (or check-out): this screen was showing stale
      // status. Refetch so the app shows the real state instead of a dead-end error.
      const alreadyDone =
        error instanceof AxiosError &&
        error.response?.status === 409 &&
        /already checked (in|out)/i.test(String((error.response.data as { error?: string } | undefined)?.error ?? ""));
      if (alreadyDone) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["attendance-status"] }),
          queryClient.invalidateQueries({ queryKey: ["attendance-history"] }),
        ]);
        resetForm();
        navigation.navigate("Dashboard" as never);
        return;
      }
      // Surfaced via the IssueDialog below, driven by checkInOut.error.
      setIssueOpen(true);
    }
  };

  if (cameraTarget) {
    return (
      <PhotoCaptureView
        onCapture={(base64) => {
          if (cameraTarget === "presence") setPhotoDataUrl(`data:image/jpeg;base64,${base64}`);
          else setOvertimeSummaryPhotoDataUrl(`data:image/jpeg;base64,${base64}`);
          setCameraTarget(null);
        }}
        onCancel={() => setCameraTarget(null)}
      />
    );
  }

  const shiftStart = status?.exists ? fmtShift(status.shiftStartTime) : null;
  const shiftEnd = status?.exists ? fmtShift(status.shiftEndTime) : null;
  const modeWord = isFieldEmployee
    ? fieldCheckInMode === "FIELD"
      ? "Field"
      : "Office"
    : isWfhEmployee
      ? wfhCheckInMode === "HOME"
        ? "Home"
        : "Office"
      : isHybridEmployee
        ? hybridCheck?.place === "HOME"
          ? "Hybrid · Home"
          : hybridCheck?.place === "OFFICE"
            ? "Hybrid · Office"
            : "Hybrid"
        : "Office";
  // Once checked in, today's mode is fixed (status.checkInMode) — the pickers
  // above are hidden and their local state may not reflect it. Display only.
  const lockedMode = action === "CHECK_OUT" && status?.exists ? status.checkInMode : null;
  const headerMode =
    lockedMode === "FIELD" ? "Field" : lockedMode === "HOME" ? "Home" : lockedMode === "OFFICE" ? "Office" : modeWord;
  // HYBRID: which place the check-in will count at (or how far the nearer one is).
  const hybridPlaceLabel = hybridCheck
    ? hybridCheck.place === "OFFICE"
      ? "You're at the office"
      : hybridCheck.place === "HOME"
        ? "You're at home"
        : hybridCheck.nearest
          ? `Not at the office or home · ${formatDistance(hybridCheck.nearest.distance)} from ${
              hybridCheck.nearest.place === "HOME" ? "home" : "the office"
            }`
          : null
    : null;
  const headerKicker = shiftStart ? `${headerMode} · ${shiftStart} shift` : headerMode;
  const isSubmitting = checkInOut.isPending || saveOffline.isSaving;
  const ringKicker = isSubmitting
    ? "PROCESSING"
    : canSubmit
      ? "SLIDE TO CONFIRM"
      : "BLOCKED";
  const ringTitle = isSubmitting
    ? offlineMode
      ? "Saving…"
      : "Confirming…"
    : action === "CHECK_IN"
      ? "Slide to check in"
      : "Slide to check out";
  // Short "what's still missing" label shown inside the locked track (mockup
  // "Take your photo to unlock"); the longer explanation sits below it.
  const lockedLabel =
    canSubmit || isSubmitting
      ? null
      : requiresPhoto && !photoDataUrl
        ? "Take your photo to unlock"
        : pin.length < 4
          ? "Enter your PIN to unlock"
          : needsOdometer && !odometerValid
            ? "Enter the km reading to unlock"
            : !locationOk
              ? geofence.isLoading
                ? "Getting your location…"
                : withinRadius === false
                  ? "Out of range"
                  : "Location needed to unlock"
              : "Locked";
  const ringHelp = canSubmit
    ? offlineMode
      ? "You're offline — this is saved on the phone and sent automatically. The server checks it then."
      : SERVER_NOTE
    : offlineMode && !locationOk
      ? geofence.isLoading
        ? "Getting your location…"
        : withinRadius === false
          ? isHybridEmployee
            ? "You're outside both the office and your home."
            : "You're outside your work area."
          : "Your location is needed to unlock."
    : isHybridEmployee && !locationOk && !geofence.isLoading && pin.length >= 4 && (!requiresPhoto || !!photoDataUrl)
      ? "Check in from the office or from home."
    : needsOdometer && !odometerValid
      ? `Enter the ${action === "CHECK_IN" ? "start" : "end"} km reading to unlock.`
      : requiresGeofence && withinRadius === false
        ? "Move inside your work area to unlock."
        : SERVER_NOTE;

  // Geofence hero copy.
  const geoTitle = geofence.isLoading
    ? "Locating…"
    : geofence.error
      ? "No location"
      : isHybridEmployee && hybridCheck
        ? hybridCheck.place === "OFFICE"
          ? "At the office"
          : hybridCheck.place === "HOME"
            ? "At home"
            : "Not at either"
        : withinRadius === true
          ? "Inside range"
          : withinRadius === false
            ? "Outside range"
            : "Checking range";
  const geoSub = geofence.isLoading
    ? "Getting your location…"
    : geofence.error
      ? geofence.error
      : isHybridEmployee
        ? (hybridPlaceLabel ?? "Office or home")
        : target
          ? `${modeWord} · geofence ${Math.round(target.radiusMeters)} m`
          : modeWord;

  const pinDone = pin.length >= 4;
  let rise = 0;
  const nextDelay = () => {
    const d = rise;
    rise += 80;
    return d;
  };

  return (
    <Screen scroll glow="subtle" contentStyle={styles.content}>
      <Rise delay={nextDelay()} style={styles.header}>
        <View style={styles.headerText}>
          <Kicker>{headerKicker}</Kicker>
          <ScreenTitle style={styles.title}>{action === "CHECK_IN" ? "Check in" : "Check out"}</ScreenTitle>
        </View>
        {shiftEnd ? <Text style={styles.headerAside}>Shift ends {shiftEnd}</Text> : null}
      </Rise>

      {offlineMode ? (
        <Rise delay={nextDelay()} style={styles.offlineBanner}>
          <Icon name="wifi" size={18} color={colors.accentText} />
          <View style={styles.offlineBannerTextWrap}>
            <Text style={styles.offlineBannerTitle}>You're offline</Text>
            <Text style={styles.offlineBannerText}>
              Your {action === "CHECK_IN" ? "check-in" : "check-out"} will be saved and sent automatically.
            </Text>
          </View>
        </Rise>
      ) : null}

      {effective.pendingCheckIn && action === "CHECK_OUT" ? (
        <StatusBadge label="Checked in · pending sync" tone="warning" />
      ) : null}

      {showFieldPicker ? (
        <Rise delay={nextDelay()}>
          <SegmentedControl
            options={[
              { key: "OFFICE", label: "Office" },
              { key: "FIELD", label: "Field work" },
            ]}
            value={fieldCheckInMode}
            onChange={setFieldCheckInMode}
          />
        </Rise>
      ) : null}

      {showHomePicker ? (
        <Rise delay={nextDelay()}>
          <SegmentedControl
            options={[
              { key: "HOME", label: "Home" },
              { key: "OFFICE", label: "Office" },
            ]}
            value={wfhCheckInMode}
            onChange={setWfhCheckInMode}
          />
        </Rise>
      ) : null}

      {isPaused ? (
        <StatusBadge
          label={isPermissionPause ? "Paused — on requested permission" : "Paused — outside your work area"}
          tone="warning"
        />
      ) : null}

      {/* Same card the Dashboard shows for an active overtime request — shown
          here too so a decline is visible right on the screen the employee
          is actually using to check out, not only on a different tab (see
          OvertimeStatusCard's own comment on why "Declined" still renders
          here rather than being hidden). */}
      {currentOvertime ? (
        <View style={styles.overtimeWrap}>
          <OvertimeStatusCard request={currentOvertime} />
        </View>
      ) : null}

      {offlineMode && !requiresGeofence && needsOfflineCoords ? (
        <Card>
          <Kicker>Location</Kicker>
          {geofence.isLoading ? (
            <Text style={styles.meta}>Getting your location…</Text>
          ) : geofence.error ? (
            <Text style={styles.errorText}>{geofence.error}</Text>
          ) : geofence.coords ? (
            <Text style={styles.meta}>Saved with your check-in; the server checks the distance when it's sent.</Text>
          ) : null}
          <Pressable onPress={geofence.refresh} hitSlop={6} style={styles.refreshRow}>
            <Icon name="refresh" size={14} color={colors.accentText} strokeWidth={2} />
            <Text style={styles.refreshLink}>Refresh</Text>
          </Pressable>
        </Card>
      ) : null}

      {requiresGeofence ? (
        <Rise delay={nextDelay()}>
          <GlowPanel style={styles.geoPanel}>
            <GeoBeacon outside={withinRadius === false} />
            <View style={styles.geoBody}>
              <Text style={styles.geoKicker}>GEOFENCE</Text>
              <Text style={styles.geoTitle} numberOfLines={1}>
                {geoTitle}
              </Text>
              <Text style={[styles.geoSub, geofence.error ? styles.geoSubError : null]} numberOfLines={2}>
                {geoSub}
              </Text>
            </View>
            <View style={styles.geoAside}>
              {shownDistance !== null && !geofence.isLoading && !geofence.error ? (
                <Text
                  style={[styles.geoChip, withinRadius === false && styles.geoChipOut]}
                  accessibilityLabel={`${withinRadius ? "In range" : "Out of range"}, ${formatDistance(shownDistance)}`}
                >
                  {formatDistance(shownDistance)}
                </Text>
              ) : null}
              <Pressable
                onPress={geofence.refresh}
                accessibilityLabel="Refresh location"
                hitSlop={6}
                style={({ pressed }) => [styles.geoRefresh, pressed && { opacity: 0.6 }]}
              >
                <Icon name="refresh" size={16} color={colors.panelHeroText} strokeWidth={2} />
              </Pressable>
            </View>
          </GlowPanel>
        </Rise>
      ) : null}

      {requiresPhoto ? (
        <Rise delay={nextDelay()}>
          <Card style={styles.photoCard}>
            <Pressable onPress={() => setCameraTarget("presence")} style={styles.photoAvatar} accessibilityLabel="Take presence photo">
              {photoDataUrl ? (
                <Image source={{ uri: photoDataUrl }} style={styles.photoAvatarImage} />
              ) : (
                <Icon name="person" size={26} color={colors.textMuted} strokeWidth={1.4} />
              )}
            </Pressable>
            <View style={styles.photoBody}>
              <Text style={styles.photoTitle}>Presence photo</Text>
              <Text style={styles.photoSub}>{photoDataUrl ? "Captured just now" : "Required · front camera"}</Text>
            </View>
            <Pressable
              onPress={() => setCameraTarget("presence")}
              style={({ pressed }) => [styles.softButton, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.softButtonLabel}>{photoDataUrl ? "Retake" : "Take photo"}</Text>
            </Pressable>
            <StepTick done={!!photoDataUrl} />
          </Card>
        </Rise>
      ) : null}

      {showOvertimeSummary ? (
        <Rise delay={nextDelay()}>
          <Card style={styles.stack}>
            <Kicker>Overtime summary (optional)</Kicker>
            <TextField
              placeholder="What did you get done? Never required to check out."
              value={overtimeSummary}
              onChangeText={setOvertimeSummary}
              multiline
            />
            <Pressable
              onPress={() => setCameraTarget("overtime")}
              style={[styles.overtimeSummaryPhotoTile, overtimeSummaryPhotoDataUrl && styles.photoTileReady]}
            >
              {overtimeSummaryPhotoDataUrl ? (
                <Image source={{ uri: overtimeSummaryPhotoDataUrl }} style={styles.overtimeSummaryPhotoPreview} />
              ) : (
                <View style={styles.overtimePhotoEmpty}>
                  <Icon name="camera" size={22} color={colors.accentText} />
                  <Text style={styles.metaSmall}>Add a photo (optional)</Text>
                </View>
              )}
            </Pressable>
          </Card>
        </Rise>
      ) : null}

      {needsOdometer ? (
        <Rise delay={nextDelay()}>
          <Card style={styles.stack}>
            <View style={styles.cardHeadRow}>
              <Kicker>{action === "CHECK_IN" ? "Start km" : "End km"}</Kicker>
              <StepTick done={odometerValid} />
            </View>
            <Text style={styles.meta}>
              {action === "CHECK_IN"
                ? "Enter the vehicle's odometer reading before you start."
                : "Enter the odometer reading now that you've finished."}
            </Text>
            <TextField
              placeholder="e.g. 12450"
              value={odometer}
              onChangeText={(t) => setOdometer(t.replace(/[^0-9.]/g, ""))}
              keyboardType="decimal-pad"
              maxLength={9}
              icon="car"
            />
          </Card>
        </Rise>
      ) : null}

      <Rise delay={nextDelay()}>
        <Card style={styles.pinCard}>
          <View style={styles.cardHeadRow}>
            <Kicker>PIN</Kicker>
            <View style={styles.pinStatus}>
              <Text style={styles.pinHint}>{pinDone ? "Entered" : "Tap to enter 4–6 digits"}</Text>
              <StepTick done={pinDone} />
            </View>
          </View>
          <PinBoxInput value={pin} onChange={setPin} />
        </Card>
      </Rise>

      <Rise delay={nextDelay()} style={styles.confirmWrap}>
        <SlideToConfirmTrack
          kicker={ringKicker}
          title={lockedLabel ?? ringTitle}
          helpText={ringHelp}
          disabled={!canSubmit || isSubmitting}
          onConfirm={handleSubmit}
        />
      </Rise>

      <IssueDialog
        visible={issueOpen && checkInOut.isError}
        kicker={isNetworkError(checkInOut.error) ? "NO CONNECTION" : action === "CHECK_IN" ? "CHECK-IN BLOCKED" : "CHECK-OUT BLOCKED"}
        title={
          isNetworkError(checkInOut.error)
            ? "You're offline"
            : action === "CHECK_IN"
              ? "Couldn't check in"
              : "Couldn't check out"
        }
        body={getErrorMessage(checkInOut.error)}
        primaryLabel="Try again"
        onPrimary={() => {
          setIssueOpen(false);
          setPin("");
        }}
        secondaryLabel="Dismiss"
        onSecondary={() => setIssueOpen(false)}
      />

      <IssueDialog
        visible={!!offlineIssue}
        kicker="OFFLINE"
        title={offlineIssue?.title ?? ""}
        body={offlineIssue?.body ?? ""}
        primaryLabel="OK"
        onPrimary={() => setOfflineIssue(null)}
      />
    </Screen>
  );
}

/** Mockup `.sti`: 26px step tick — empty ring, or a filled green circle with a white check that pops in. */
function StepTick({ done }: { done: boolean }) {
  const reduced = useReducedMotion();
  const t = useRef(new Animated.Value(done ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) {
      t.setValue(done ? 1 : 0);
      return;
    }
    const anim = Animated.timing(t, { toValue: done ? 1 : 0, duration: 250, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [done, reduced, t]);
  return (
    <View style={styles.tick} accessibilityLabel={done ? "Done" : "Not done"}>
      <Animated.View
        style={[
          styles.tickFill,
          { opacity: t, transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] },
        ]}
      >
        <Icon name="checkmark" size={14} color="#FFFFFF" strokeWidth={3.2} />
      </Animated.View>
    </View>
  );
}

/** One expanding ring of the geofence beacon (mockup `ring`: scale .3 -> 1.6, fade .7 -> 0, 2.6s). */
function BeaconRing({ delay, color }: { delay: number; color: string }) {
  const t = useLoop({ duration: 2600, delay, easing: loopEasing.easeOut, restValue: 1 });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.beaconRing,
        { borderColor: color },
        {
          opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
          transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.6] }) }],
        },
      ]}
    />
  );
}

/** Pin in an orange disc with two staggered expanding rings (CheckIn.dc.html geofence hero). */
function GeoBeacon({ outside }: { outside: boolean }) {
  const color = outside ? "#FF5C5C" : colors.primary;
  return (
    <View style={styles.beacon}>
      <BeaconRing delay={0} color={color} />
      <BeaconRing delay={1300} color={color} />
      <View style={[styles.beaconCore, { backgroundColor: color }]}>
        <Icon name="pin" size={16} color={colors.onOrange} strokeWidth={2.2} />
      </View>
    </View>
  );
}

/** Success badge: green disc that pops in, a soft halo pulsing behind it, and the check fading in after. */
function DoneBadge() {
  const reduced = useReducedMotion();
  const pop = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const check = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) return;
    const anim = Animated.parallel([
      Animated.spring(pop, { toValue: 1, friction: 5, tension: 90, useNativeDriver: true }),
      Animated.timing(check, { toValue: 1, duration: 600, delay: 300, useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={styles.doneBadge}>
      <PulseRing size={96} color="rgba(30,142,90,0.35)" scaleTo={1.8} opacityFrom={0.5} duration={2000} />
      <Animated.View style={[styles.doneDisc, { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] }]}>
        <Animated.View style={{ opacity: check, transform: [{ scale: check.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }}>
          <Icon name="checkmark" size={46} color="#FFFFFF" strokeWidth={2.6} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

/** Full-screen result layout (mockup "You're checked out"): badge, title, date, a dark summary panel and the CTA at the bottom. */
function EndState({
  icon,
  badge,
  title,
  meta,
  children,
  footer,
}: {
  icon: ReactNode;
  badge?: ReactNode;
  title: string;
  meta?: string;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Screen glow="subtle" contentStyle={styles.endState}>
      <Rise style={styles.endTop}>
        {icon}
        {badge ? <View style={styles.endBadge}>{badge}</View> : null}
        <Text style={styles.endTitle}>{title}</Text>
        {meta ? <Text style={styles.endMeta}>{meta}</Text> : null}
      </Rise>
      {children ? <Rise delay={150}>{children}</Rise> : null}
      <View style={styles.endSpacer} />
      {footer ? <Rise delay={250}>{footer}</Rise> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.md, gap: 12 },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  headerText: { flex: 1, minWidth: 0 },
  title: { marginTop: 2 },
  headerAside: { fontFamily: fontFamilies.medium, fontWeight: "500", fontSize: 12, color: colors.textSecondary, paddingBottom: 6 },

  // End states (saved offline / all done / on leave).
  endState: { paddingHorizontal: 24, paddingTop: 96, alignItems: "stretch" },
  endTop: { alignItems: "center" },
  endBadge: { marginTop: spacing.md },
  endTitle: {
    fontFamily: fontFamilies.display700,
    fontWeight: "700",
    fontSize: 28,
    letterSpacing: -0.5,
    color: colors.ink,
    textAlign: "center",
    marginTop: 26,
  },
  endMeta: { fontSize: 14, lineHeight: 20, color: colors.textSecondary, textAlign: "center", marginTop: 6 },
  endPanel: { borderRadius: 26, padding: 18, marginTop: 28 },
  endPanelKicker: { ...typography.kicker, color: colors.panelHeroMuted },
  endPanelValue: { ...typography.display, fontSize: 40, lineHeight: 46, color: colors.panelHeroText, marginTop: 4 },
  endPanelBody: { ...typography.bodyStrong, color: colors.panelHeroText, marginTop: 6 },
  endPanelMuted: { fontSize: 13, lineHeight: 18, color: colors.panelHeroMuted, marginTop: 4 },
  endSpacer: { flex: 1, minHeight: spacing.lg },
  doneBadge: { width: 96, height: 96 },
  doneDisc: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#1E8E5A",
    alignItems: "center",
    justifyContent: "center",
  },

  offlineBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm + 2,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: "rgba(239,108,0,0.28)",
    borderRadius: radius.chip,
    padding: spacing.sm + 4,
  },
  offlineBannerTextWrap: { flex: 1 },
  offlineBannerTitle: { ...typography.bodyStrong, fontSize: 14, color: colors.accentText, marginBottom: 2 },
  offlineBannerText: { ...typography.caption, color: colors.accentText },
  // OvertimeStatusCard carries its own top margin (Home layout); cancel it here.
  overtimeWrap: { marginTop: -(spacing.sm + 4) },
  stack: { gap: spacing.sm },
  meta: { ...typography.caption, color: colors.textSecondary },
  metaSmall: { ...typography.caption, fontSize: 12, color: colors.textSecondary },
  errorText: { ...typography.caption, color: colors.danger, marginBottom: spacing.sm },
  refreshRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: spacing.xs + 2,
    alignSelf: "flex-start",
  },
  refreshLink: { ...typography.link, color: colors.accentText },

  // Geofence hero (dark panel).
  geoPanel: {
    borderRadius: 26,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  beacon: { width: 76, height: 76, alignItems: "center", justifyContent: "center" },
  beaconRing: {
    position: "absolute",
    left: 3,
    top: 3,
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
  },
  beaconCore: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  geoBody: { flex: 1, minWidth: 0 },
  geoKicker: { ...typography.kicker, color: colors.panelHeroMuted },
  geoTitle: {
    fontFamily: fontFamilies.display700,
    fontWeight: "700",
    fontSize: 22,
    color: colors.panelHeroText,
    marginTop: 3,
  },
  geoSub: { fontSize: 12, lineHeight: 16, color: colors.panelHeroMuted, marginTop: 2 },
  geoSubError: { color: "#FF9C9C" },
  geoAside: { alignItems: "flex-end", gap: 8 },
  geoChip: {
    fontFamily: fontFamilies.display700,
    fontWeight: "700",
    fontSize: 15,
    color: colors.panelHeroText,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 99,
    overflow: "hidden",
    paddingHorizontal: 13,
    paddingVertical: 7,
    fontVariant: ["tabular-nums"],
  },
  geoChipOut: { color: "#FF9C9C" },
  geoRefresh: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.panelHeroChip,
    alignItems: "center",
    justifyContent: "center",
  },

  // Presence photo row.
  photoCard: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  photoAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#EEEAE5",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  photoAvatarImage: { width: 48, height: 48 },
  photoBody: { flex: 1, minWidth: 0 },
  photoTitle: { ...typography.cardTitle, color: colors.ink },
  photoSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  softButton: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "rgba(239,108,0,0.12)",
    borderWidth: 1,
    borderColor: "rgba(239,108,0,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  softButtonLabel: { fontFamily: fontFamilies.semiBold, fontWeight: "600", fontSize: 13, color: colors.accentText },
  tick: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: "rgba(23,19,15,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  tickFill: {
    position: "absolute",
    left: -1.5,
    top: -1.5,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#1E8E5A",
    alignItems: "center",
    justifyContent: "center",
  },

  photoTileReady: { borderStyle: "solid", borderColor: "rgba(76,195,138,0.5)" },
  overtimeSummaryPhotoTile: {
    height: 96,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(239,108,0,0.35)",
    borderRadius: radius.tile,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  overtimePhotoEmpty: { alignItems: "center", gap: spacing.xs },
  overtimeSummaryPhotoPreview: { width: "100%", height: "100%" },

  cardHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pinCard: { padding: 14, gap: 10 },
  pinStatus: { flexDirection: "row", alignItems: "center", gap: 8 },
  pinHint: { fontSize: 12, color: colors.textSecondary },
  confirmWrap: { marginTop: 2, marginBottom: spacing.md },
});
