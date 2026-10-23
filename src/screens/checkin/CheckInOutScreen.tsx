import { useEffect, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { useNetInfo } from "@react-native-community/netinfo";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
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
} from "@/components/ui";
import { DistancePill } from "@/components/attendance";
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
} from "@/hooks";
import { useCheckInDraftStore } from "@/store/checkInDraftStore";
import { useTrackingFixStore } from "@/store/trackingFixStore";
import { checkTrackingReadiness } from "@/services/trackingReadiness";
import { checkPinLocally } from "@/services/pinVerifier";
import { syncOfflineQueue } from "@/services/offlineQueue";
import { useOfflineQueueStore } from "@/store/offlineQueueStore";
import { getErrorMessage, isNetworkError } from "@/utils/errors";
import { colors, radius, spacing, typography } from "@/theme";
import type { AttendanceAction, CheckInMode, ScanRequest, TimeOffType } from "@/types";

const TYPE_LABEL: Record<TimeOffType, string> = {
  CASUAL: "Casual",
  SICK: "Sick",
  EARNED: "Earned",
};

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

  const target = useResolvedGeofenceTarget(dayOverrideMode);
  const geofence = useGeofence(target);

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
      <Screen contentStyle={styles.endState}>
        <View style={styles.endIcon}>
          <Icon name="check" size={44} color={colors.lime} />
        </View>
        <StatusBadge label="Pending sync" tone="warning" style={styles.endBadge} />
        <ScreenTitle style={styles.endTitle}>
          {savedOffline.action === "CHECK_IN" ? "Check-in saved" : "Check-out saved"}
        </ScreenTitle>
        <Text style={styles.endMeta}>
          {savedOffline.sendingNow
            ? "Saved on this device. Sending now, right after your earlier offline check-in."
            : "Saved on this device. Will be sent when you're back online."}
        </Text>
        {savedOffline.pinUnverified ? (
          <Text style={styles.endMeta}>Your PIN couldn't be checked offline — it's verified when it's sent.</Text>
        ) : null}
        <Button
          label="Go to Dashboard"
          variant="primary"
          onPress={() => {
            setSavedOffline(null);
            navigation.navigate("Dashboard" as never);
          }}
          style={styles.savedButton}
        />
      </Screen>
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
    return (
      <Screen contentStyle={styles.endState}>
        <View style={styles.endIcon}>
          <Icon name="check" size={44} color={colors.lime} />
        </View>
        <ScreenTitle style={styles.endTitle}>All done for today</ScreenTitle>
        <Text style={styles.endMeta}>You've already checked in and out today.</Text>
        {effective.pendingCheckIn || effective.pendingCheckOut ? (
          <>
            <StatusBadge label="Pending sync" tone="warning" style={styles.pendingBadge} />
            <Text style={styles.endMeta}>Saved on this device. Will be sent when you're back online.</Text>
          </>
        ) : null}
      </Screen>
    );
  }

  // Check-in is blocked server-side on an approved leave day (see
  // /api/kiosk/scan) — show this instead of a form that would just fail.
  // Check-out is left alone: if they already checked in before leave was
  // approved, they still need to be able to close their day out normally.
  if (!checkedIn && todayLeave) {
    return (
      <Screen contentStyle={styles.endState}>
        <IconTile icon="calendar" tone="success" size={84} radius={42} />
        <ScreenTitle style={styles.endTitle}>You're on leave today</ScreenTitle>
        <Text style={styles.endMeta}>
          Your {TYPE_LABEL[todayLeave.type]} leave request for today was approved — check-in is disabled.
        </Text>
      </Screen>
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
    ? geofence.withinRadius !== false && !geofence.mocked && (!needsOfflineCoords || !!geofence.coords)
    : !requiresGeofence || geofence.withinRadius === true;

  const canSubmit =
    pin.length >= 4 &&
    (!needsOdometer || odometerValid) &&
    (!requiresPhoto || !!photoDataUrl) &&
    locationOk;

  // Field days only: before checking in, make sure the phone will actually keep recording the
  // route (location "all the time" + no battery restriction). If not, show the fix-it sheet
  // first; the employee can still check in anyway from there.
  const handleSubmit = async () => {
    if (!user) return;
    if (action === "CHECK_IN" && needsOdometer) {
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
  const ringHelp = canSubmit
    ? offlineMode
      ? "You're offline — this is saved on the phone and sent automatically. The server checks it then."
      : "The server re-checks your PIN, photo and distance before it counts."
    : offlineMode && !locationOk
      ? geofence.isLoading
        ? "Getting your location…"
        : geofence.withinRadius === false
          ? "You're outside your work area."
          : "Your location is needed to unlock."
    : needsOdometer && !odometerValid
      ? `Enter the ${action === "CHECK_IN" ? "start" : "end"} km reading to unlock.`
      : requiresPhoto && !photoDataUrl
        ? "Take the presence photo and enter your PIN to unlock."
        : "Enter your PIN to unlock.";

  return (
    <Screen scroll>
      <Kicker style={styles.kicker}>{action === "CHECK_IN" ? "Step 1 of 1" : "Confirm"}</Kicker>
      <ScreenTitle>{action === "CHECK_IN" ? "Check in" : "Check out"}</ScreenTitle>
      <Text style={styles.subtitle}>
        {user?.employeeCode} · {user?.name}
      </Text>

      {offlineMode ? (
        <View style={styles.offlineBanner}>
          <Icon name="wifi" size={18} color={colors.limeDeep} />
          <View style={styles.offlineBannerTextWrap}>
            <Text style={styles.offlineBannerTitle}>You're offline</Text>
            <Text style={styles.offlineBannerText}>
              Your {action === "CHECK_IN" ? "check-in" : "check-out"} will be saved and sent automatically.
            </Text>
          </View>
        </View>
      ) : null}

      {effective.pendingCheckIn && action === "CHECK_OUT" ? (
        <View style={styles.pausedBadgeWrap}>
          <StatusBadge label="Checked in · pending sync" tone="warning" />
        </View>
      ) : null}

      {showFieldPicker ? (
        <SegmentedControl
          variant="ink"
          options={[
            { key: "OFFICE", label: "Office" },
            { key: "FIELD", label: "Field work" },
          ]}
          value={fieldCheckInMode}
          onChange={setFieldCheckInMode}
          style={styles.modeRow}
        />
      ) : null}

      {showHomePicker ? (
        <SegmentedControl
          variant="ink"
          options={[
            { key: "HOME", label: "Home" },
            { key: "OFFICE", label: "Office" },
          ]}
          value={wfhCheckInMode}
          onChange={setWfhCheckInMode}
          style={styles.modeRow}
        />
      ) : null}

      {isPaused ? (
        <View style={styles.pausedBadgeWrap}>
          <StatusBadge
            label={isPermissionPause ? "Paused — on requested permission" : "Paused — outside your work area"}
            tone="warning"
          />
        </View>
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
        <Card style={styles.card}>
          <Kicker>Location</Kicker>
          {geofence.isLoading ? (
            <Text style={styles.meta}>Getting your location…</Text>
          ) : geofence.error ? (
            <Text style={styles.errorText}>{geofence.error}</Text>
          ) : geofence.coords ? (
            <Text style={styles.meta}>Saved with your check-in; the server checks the distance when it's sent.</Text>
          ) : null}
          <Pressable onPress={geofence.refresh} hitSlop={6} style={styles.refreshRow}>
            <Icon name="refresh" size={14} color={colors.primaryDark} strokeWidth={2} />
            <Text style={styles.refreshLink}>Refresh</Text>
          </Pressable>
        </Card>
      ) : null}

      {requiresGeofence && requiresPhoto ? (
        <View style={styles.row}>
          <Card style={styles.geofenceCard}>
            <Kicker>Geofence</Kicker>
            {geofence.isLoading ? (
              <Text style={styles.meta}>Getting your location…</Text>
            ) : geofence.error ? (
              <Text style={styles.errorText}>{geofence.error}</Text>
            ) : (
              <DistancePill distanceMeters={geofence.distanceMeters} withinRadius={geofence.withinRadius} />
            )}
            <Pressable onPress={geofence.refresh} hitSlop={6} style={styles.refreshRow}>
              <Icon name="refresh" size={14} color={colors.primaryDark} strokeWidth={2} />
              <Text style={styles.refreshLink}>Refresh</Text>
            </Pressable>
          </Card>
          <Pressable
            onPress={() => setCameraTarget("presence")}
            style={[styles.photoTile, photoDataUrl && styles.photoTileReady]}
          >
            {photoDataUrl ? (
              <>
                <Image source={{ uri: photoDataUrl }} style={styles.photoTileImage} />
                <View style={styles.photoTileBadge}>
                  <Icon name="checkmark" size={12} color={colors.lime} strokeWidth={2.4} />
                </View>
              </>
            ) : (
              <IconTile icon="user" tone="muted" size={44} />
            )}
            <Text style={styles.photoTileLabel}>{photoDataUrl ? "PHOTO READY" : "PRESENCE PHOTO"}</Text>
          </Pressable>
        </View>
      ) : requiresPhoto ? (
        <Card style={styles.card}>
          <Kicker>Presence photo</Kicker>
          {photoDataUrl ? (
            <Image source={{ uri: photoDataUrl }} style={styles.photoPreview} />
          ) : (
            <Text style={styles.meta}>
              A photo is required to {action === "CHECK_IN" ? "check in" : "check out"}.
            </Text>
          )}
          <Button
            label={photoDataUrl ? "Retake photo" : "Take photo"}
            variant="secondary"
            size="sm"
            icon="camera"
            onPress={() => setCameraTarget("presence")}
            style={styles.retakeButton}
          />
        </Card>
      ) : null}

      {showOvertimeSummary ? (
        <Card style={styles.card}>
          <Kicker>Overtime summary (optional)</Kicker>
          <Text style={styles.meta}>What did you get done? Never required to check out.</Text>
          <TextField
            placeholder="e.g. Fixed the payment gateway bug and deployed the hotfix"
            value={overtimeSummary}
            onChangeText={setOvertimeSummary}
            multiline
            style={styles.overtimeSummaryInput}
          />
          <Pressable
            onPress={() => setCameraTarget("overtime")}
            style={[styles.overtimeSummaryPhotoTile, overtimeSummaryPhotoDataUrl && styles.photoTileReady]}
          >
            {overtimeSummaryPhotoDataUrl ? (
              <Image source={{ uri: overtimeSummaryPhotoDataUrl }} style={styles.overtimeSummaryPhotoPreview} />
            ) : (
              <View style={styles.overtimePhotoEmpty}>
                <Icon name="camera" size={22} color={colors.ink} />
                <Text style={styles.metaSmall}>Add a photo (optional)</Text>
              </View>
            )}
          </Pressable>
        </Card>
      ) : null}

      {needsOdometer ? (
        <Card style={styles.card}>
          <Kicker>{action === "CHECK_IN" ? "Start km" : "End km"}</Kicker>
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
            style={styles.odometerInput}
          />
        </Card>
      ) : null}

      <Card style={styles.card}>
        <View style={styles.pinHeaderRow}>
          <Kicker style={styles.pinKicker}>PIN</Kicker>
          <Text style={styles.pinHint}>{pin.length ? `${pin.length} of 4+ digits` : "4 to 6 digits"}</Text>
        </View>
        <PinBoxInput value={pin} onChange={setPin} />
      </Card>

      <View style={styles.confirmWrap}>
        <SlideToConfirmTrack
          kicker={ringKicker}
          title={ringTitle}
          helpText={ringHelp}
          disabled={!canSubmit || isSubmitting}
          onConfirm={handleSubmit}
        />
      </View>

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

const styles = StyleSheet.create({
  // End states (saved offline / all done / on leave): centred, like the mockup's "saved" screen.
  endState: { alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  endIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  endBadge: { alignSelf: "center", marginTop: spacing.md },
  endTitle: { textAlign: "center", marginTop: spacing.sm + 2 },
  endMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
    lineHeight: 19,
  },
  pendingBadge: { alignSelf: "center", marginTop: spacing.md },
  pausedBadgeWrap: { marginBottom: spacing.sm + 4 },
  savedButton: { marginTop: spacing.lg, alignSelf: "stretch" },
  offlineBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm + 2,
    backgroundColor: colors.primaryMuted,
    borderRadius: radius.input,
    padding: spacing.sm + 4,
    marginBottom: spacing.sm + 4,
  },
  offlineBannerTextWrap: { flex: 1 },
  offlineBannerTitle: { ...typography.bodyStrong, fontSize: 14, color: colors.limeDeep, marginBottom: 2 },
  offlineBannerText: { ...typography.caption, color: colors.limeDeep },
  kicker: { marginTop: spacing.xs },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 4, marginBottom: spacing.md + 2 },
  modeRow: { marginBottom: spacing.sm + 4 },
  // OvertimeStatusCard carries its own top margin (Home layout); cancel it here.
  overtimeWrap: { marginTop: -(spacing.sm + 4), marginBottom: spacing.sm + 4 },
  row: { flexDirection: "row", gap: spacing.sm + 2, marginBottom: spacing.sm + 4 },
  card: { marginBottom: spacing.sm + 4 },
  geofenceCard: { flex: 1, gap: spacing.xs },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  metaSmall: { ...typography.caption, fontSize: 12, color: colors.textSecondary },
  errorText: { ...typography.caption, color: colors.danger, marginBottom: spacing.sm },
  refreshRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: spacing.xs + 2,
    alignSelf: "flex-start",
  },
  refreshLink: { ...typography.bodyStrong, color: colors.primaryDark, fontSize: 13 },
  photoTile: {
    width: 100,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(14,36,16,0.3)",
    borderRadius: radius.tile,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs + 2,
    paddingVertical: spacing.sm + 2,
    overflow: "hidden",
  },
  photoTileReady: { borderStyle: "solid", borderColor: colors.success },
  photoTileImage: { width: 56, height: 56, borderRadius: 99 },
  photoTileBadge: {
    position: "absolute",
    top: spacing.sm,
    right: (100 - 56) / 2 - 4,
    width: 20,
    height: 20,
    borderRadius: 99,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  photoTileLabel: {
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.ink,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  odometerInput: { marginTop: spacing.sm, marginBottom: 0 },
  retakeButton: { marginTop: spacing.sm + 2, alignSelf: "flex-start" },
  overtimeSummaryInput: { marginTop: spacing.sm },
  overtimeSummaryPhotoTile: {
    marginTop: spacing.sm,
    height: 96,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(14,36,16,0.3)",
    borderRadius: radius.tile,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  overtimePhotoEmpty: { alignItems: "center", gap: spacing.xs },
  overtimeSummaryPhotoPreview: { width: "100%", height: "100%" },
  photoPreview: {
    width: "100%",
    height: 220,
    borderRadius: radius.tile,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  pinHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  pinKicker: { marginBottom: 0 },
  pinHint: { fontSize: 11.5, color: colors.textSecondary },
  confirmWrap: { marginTop: spacing.md, marginBottom: spacing.md },
});
