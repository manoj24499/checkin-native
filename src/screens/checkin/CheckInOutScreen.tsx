import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen, Card, Button, LoadingView, ErrorView, StatusBadge } from "@/components/ui";
import { DistancePill } from "@/components/attendance";
import { PhotoCaptureView } from "@/components/camera";
import { SlideToConfirmTrack, PinKeypad } from "@/components/checkin";
import {
  useAuth,
  useAttendanceStatus,
  useResolvedGeofenceTarget,
  useGeofence,
  useCheckInOut,
  useTimedPermissions,
  useTodayLeave,
} from "@/hooks";
import { useCheckInDraftStore } from "@/store/checkInDraftStore";
import { getErrorMessage } from "@/utils/errors";
import { colors, radius, spacing, typography } from "@/theme";
import type { CheckInMode, TimeOffType } from "@/types";

const TYPE_LABEL: Record<TimeOffType, string> = {
  CASUAL: "Casual",
  SICK: "Sick",
  EARNED: "Earned",
};

export function CheckInOutScreen() {
  const { user } = useAuth();
  const statusQuery = useAttendanceStatus(user?.employeeCode);
  // See DashboardScreen's identical comment — must stay unconditional, so it
  // can't wait for the loading/error guards below to compute `status` first.
  const hasActiveSession = statusQuery.data?.exists
    ? statusQuery.data.checkedIn && !statusQuery.data.checkedOut
    : false;
  const permissionsQuery = useTimedPermissions(hasActiveSession);
  const todayLeave = useTodayLeave();
  const checkInOut = useCheckInOut();

  const [pin, setPin] = useState("");
  const photoDataUrl = useCheckInDraftStore((s) => s.photoDataUrl);
  const setPhotoDataUrl = useCheckInDraftStore((s) => s.setPhotoDataUrl);
  const [cameraOpen, setCameraOpen] = useState(false);

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

  if (statusQuery.isLoading) return <LoadingView label="Checking today's status…" />;
  if (statusQuery.isError) {
    return <ErrorView message={getErrorMessage(statusQuery.error)} onRetry={() => statusQuery.refetch()} />;
  }

  const status = statusQuery.data;
  const checkedIn = status?.exists ? status.checkedIn : false;
  const checkedOut = status?.exists ? status.checkedOut : false;

  if (checkedIn && checkedOut) {
    return (
      <Screen>
        <Card>
          <Text style={styles.title}>All done for today</Text>
          <Text style={styles.meta}>You've already checked in and out today.</Text>
        </Card>
      </Screen>
    );
  }

  // Check-in is blocked server-side on an approved leave day (see
  // /api/kiosk/scan) — show this instead of a form that would just fail.
  // Check-out is left alone: if they already checked in before leave was
  // approved, they still need to be able to close their day out normally.
  if (!checkedIn && todayLeave) {
    return (
      <Screen>
        <Card>
          <Text style={styles.title}>You're on leave today</Text>
          <Text style={styles.meta}>
            Your {TYPE_LABEL[todayLeave.type]} leave request for today was approved — check-in is disabled.
          </Text>
        </Card>
      </Screen>
    );
  }

  const action = checkedIn ? "CHECK_OUT" : "CHECK_IN";
  const isPaused = status?.exists ? status.isPaused : false;
  const currentPermission = hasActiveSession
    ? (permissionsQuery.data ?? []).find((p) => p.status !== "resolved") ?? null
    : null;
  const isPermissionPause = currentPermission?.status === "active";
  const checkOutPhotoRequired = status?.exists ? status.checkOutPhotoRequired : false;
  // Only shown before check-in — once checked in, today's choice is locked
  // in (see status.checkInMode) and re-showing the picker would be misleading.
  const showFieldPicker = isFieldEmployee && action === "CHECK_IN";
  const showHomePicker = isWfhEmployee && action === "CHECK_IN";
  const requiresPhoto = action === "CHECK_IN" || (action === "CHECK_OUT" && checkOutPhotoRequired);
  const requiresGeofence = action === "CHECK_IN" && !!target;

  const canSubmit =
    pin.length >= 4 &&
    (!requiresPhoto || !!photoDataUrl) &&
    (!requiresGeofence || geofence.withinRadius === true);

  const handleSubmit = async () => {
    if (!user) return;
    try {
      await checkInOut.mutateAsync({
        employeeCode: user.employeeCode,
        pin,
        action,
        photo: photoDataUrl ?? undefined,
        latitude: geofence.coords?.latitude,
        longitude: geofence.coords?.longitude,
        mocked: geofence.mocked,
        checkInMode: dayOverrideMode,
      });
      setPin("");
      setPhotoDataUrl(null);
    } catch {
      // Surfaced below via checkInOut.error.
    }
  };

  if (cameraOpen) {
    return (
      <PhotoCaptureView
        onCapture={(base64) => {
          setPhotoDataUrl(`data:image/jpeg;base64,${base64}`);
          setCameraOpen(false);
        }}
        onCancel={() => setCameraOpen(false)}
      />
    );
  }

  const ringKicker = checkInOut.isPending
    ? "PROCESSING"
    : canSubmit
      ? "SLIDE TO CONFIRM"
      : "BLOCKED";
  const ringTitle = checkInOut.isPending
    ? "Confirming…"
    : action === "CHECK_IN"
      ? "Slide to check in"
      : "Slide to check out";
  const ringHelp = canSubmit
    ? "The server re-checks your PIN, photo and distance before it counts."
    : requiresPhoto && !photoDataUrl
      ? "Take the presence photo and enter your PIN to unlock."
      : "Enter your PIN to unlock.";

  return (
    <Screen scroll>
      <Text style={styles.kicker}>{action === "CHECK_IN" ? "STEP 1 OF 1" : "CONFIRM"}</Text>
      <Text style={styles.title}>{action === "CHECK_IN" ? "Check in" : "Check out"}</Text>
      <Text style={styles.subtitle}>
        {user?.employeeCode} · {user?.name}
      </Text>

      {showFieldPicker ? (
        <View style={styles.modeRow}>
          {(["OFFICE", "FIELD"] as const).map((mode) => (
            <Pressable
              key={mode}
              onPress={() => setFieldCheckInMode(mode)}
              style={[styles.modeButton, fieldCheckInMode === mode && styles.modeButtonActive]}
            >
              <Text
                style={[styles.modeButtonLabel, fieldCheckInMode === mode && styles.modeButtonLabelActive]}
              >
                {mode === "OFFICE" ? "Office" : "Field work"}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {showHomePicker ? (
        <View style={styles.modeRow}>
          {(["HOME", "OFFICE"] as const).map((mode) => (
            <Pressable
              key={mode}
              onPress={() => setWfhCheckInMode(mode)}
              style={[styles.modeButton, wfhCheckInMode === mode && styles.modeButtonActive]}
            >
              <Text style={[styles.modeButtonLabel, wfhCheckInMode === mode && styles.modeButtonLabelActive]}>
                {mode === "HOME" ? "Home" : "Office"}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {isPaused ? (
        <View style={styles.pausedBadgeWrap}>
          <StatusBadge
            label={isPermissionPause ? "Paused — on requested permission" : "Paused — outside your work area"}
            tone="warning"
          />
        </View>
      ) : null}

      {requiresGeofence && requiresPhoto ? (
        <View style={styles.row}>
          <Card style={styles.geofenceCard}>
            <Text style={styles.cardLabel}>GEOFENCE</Text>
            {geofence.isLoading ? (
              <Text style={styles.meta}>Getting your location…</Text>
            ) : geofence.error ? (
              <Text style={styles.errorText}>{geofence.error}</Text>
            ) : (
              <DistancePill distanceMeters={geofence.distanceMeters} withinRadius={geofence.withinRadius} />
            )}
            <Pressable onPress={geofence.refresh}>
              <Text style={styles.refreshLink}>Refresh</Text>
            </Pressable>
          </Card>
          <Pressable
            onPress={() => setCameraOpen(true)}
            style={[styles.photoTile, photoDataUrl && styles.photoTileReady]}
          >
            {photoDataUrl ? (
              <>
                <Image source={{ uri: photoDataUrl }} style={styles.photoTileImage} />
                <View style={styles.photoTileBadge}>
                  <Text style={styles.photoGlyphReady}>✓</Text>
                </View>
              </>
            ) : (
              <View style={styles.photoGlyphWrap}>
                <Text style={styles.photoGlyph}>⌾</Text>
              </View>
            )}
            <Text style={styles.photoTileLabel}>{photoDataUrl ? "PHOTO READY" : "PRESENCE PHOTO"}</Text>
          </Pressable>
        </View>
      ) : requiresPhoto ? (
        <Card style={styles.card}>
          <Text style={styles.cardLabel}>PRESENCE PHOTO</Text>
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
            onPress={() => setCameraOpen(true)}
            style={styles.retakeButton}
          />
        </Card>
      ) : null}

      <View style={styles.pinSection}>
        <View style={styles.pinHeaderRow}>
          <Text style={styles.cardLabel}>PIN</Text>
          <Text style={styles.pinHint}>{pin.length ? `${pin.length} of 4+ digits` : "4 to 6 digits"}</Text>
        </View>
        <PinKeypad value={pin} onChange={setPin} />
      </View>

      {checkInOut.isError ? <Text style={styles.errorText}>{getErrorMessage(checkInOut.error)}</Text> : null}

      <View style={styles.confirmWrap}>
        <SlideToConfirmTrack
          kicker={ringKicker}
          title={ringTitle}
          helpText={ringHelp}
          disabled={!canSubmit || checkInOut.isPending}
          onConfirm={handleSubmit}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pausedBadgeWrap: { marginBottom: spacing.md },
  kicker: { ...typography.label, letterSpacing: 2, color: colors.textSecondary },
  title: { ...typography.h1, color: colors.textPrimary, marginTop: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary, marginTop: 4, marginBottom: spacing.lg },
  modeRow: {
    flexDirection: "row",
    gap: 4,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: 4,
    marginBottom: spacing.md,
  },
  modeButton: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md - 2, alignItems: "center" },
  modeButtonActive: { backgroundColor: colors.surface },
  modeButtonLabel: { ...typography.bodyStrong, color: colors.textSecondary, fontSize: 13 },
  modeButtonLabelActive: { color: colors.textPrimary },
  row: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  card: { marginBottom: spacing.md },
  geofenceCard: { flex: 1, gap: spacing.xs },
  cardLabel: { fontSize: 9, letterSpacing: 1.5, color: colors.textMuted, fontWeight: "600" },
  meta: { ...typography.body, color: colors.textSecondary, marginTop: spacing.xs },
  errorText: { ...typography.caption, color: colors.danger, marginBottom: spacing.sm },
  refreshLink: { ...typography.bodyStrong, color: colors.primary, marginTop: spacing.xs, fontSize: 13 },
  photoTile: {
    width: 96,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(134,119,111,0.55)",
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    overflow: "hidden",
  },
  photoTileReady: { borderStyle: "solid", borderColor: colors.success },
  photoTileImage: { width: 56, height: 56, borderRadius: 99 },
  photoTileBadge: {
    position: "absolute",
    top: spacing.sm,
    right: (96 - 56) / 2,
    width: 18,
    height: 18,
    borderRadius: 99,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  photoGlyphWrap: {
    width: 30,
    height: 30,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: "rgba(134,119,111,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoGlyph: { color: colors.textSecondary, fontSize: 13 },
  photoGlyphReady: { color: colors.success, fontSize: 11, fontWeight: "700" },
  photoTileLabel: {
    fontSize: 9.5,
    letterSpacing: 0.5,
    color: colors.textSecondary,
    textAlign: "center",
  },
  retakeButton: { marginTop: spacing.sm, alignSelf: "flex-start" },
  photoPreview: { width: "100%", height: 220, borderRadius: radius.lg, marginBottom: spacing.sm },
  pinSection: { marginTop: spacing.xs },
  pinHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pinHint: { fontSize: 10, color: colors.textMuted },
  confirmWrap: { marginTop: spacing.xl, marginBottom: spacing.md },
});
