import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { locationService } from "@/api/services";
import { useAttendanceSessionStore } from "@/store/attendanceSessionStore";

export const LOCATION_TRACKING_TASK = "checkin-location-tracking";

// The admin dashboard marks an employee "Offline" once their last ping is
// older than LIVE_THRESHOLD_MS = 3 minutes (components/DashboardWorkspace.tsx
// in the backend project). Pinging slower than that guarantees the employee
// spends more time looking offline than live, so this must stay under 3
// minutes — 2 minutes leaves headroom for network latency/retries.
export const PING_INTERVAL_MS = 2 * 60 * 1000;

type BackgroundLocationTaskBody = {
  locations: Location.LocationObject[];
};

// Registered once, at JS-engine startup (imported from index.ts before the
// app root mounts) so it also fires when iOS/Android relaunches the app
// headlessly to deliver a background location update.
TaskManager.defineTask(LOCATION_TRACKING_TASK, async ({ data, error }) => {
  if (error) return;

  const attendanceId = useAttendanceSessionStore.getState().activeAttendanceId;
  if (!attendanceId) {
    await stopLocationTracking();
    return;
  }

  const { locations } = (data ?? { locations: [] }) as BackgroundLocationTaskBody;
  const latest = locations[locations.length - 1];
  if (!latest) return;

  if (latest.mocked) {
    // Drop this sample rather than reporting a fake position — if every
    // subsequent ping is also mocked, the employee will simply age past the
    // admin dashboard's 3-minute "Live" threshold and show as Offline,
    // which is a more honest signal than a spoofed location.
    console.warn("Skipping location ping — mock location detected");
    return;
  }

  try {
    const result = await locationService.sendPing({
      attendanceId,
      latitude: latest.coords.latitude,
      longitude: latest.coords.longitude,
      accuracy: latest.coords.accuracy ?? 0,
      timestamp: new Date(latest.timestamp).toISOString(),
    });
    if (!result.tracking) {
      await stopLocationTracking();
      useAttendanceSessionStore.getState().stopTracking();
    }
  } catch {
    // Transient network failure — the next scheduled ping will retry.
  }
});

export async function requestLocationPermissions(): Promise<{
  foreground: boolean;
  background: boolean;
}> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== "granted") {
    return { foreground: false, background: false };
  }
  const background = await Location.requestBackgroundPermissionsAsync();
  return { foreground: true, background: background.status === "granted" };
}

/**
 * Starts (or resumes) background location pings. Every known failure mode
 * (permission denied, the native call itself throwing — e.g. in Expo Go,
 * which has no background-location entitlement in its fixed Info.plist) is
 * caught internally and surfaced via the store's `trackingWarning` instead
 * of throwing, so callers can't accidentally assume tracking is active just
 * because check-in succeeded — and so does the employee, via PresenceCard.
 *
 * Android in particular will not prompt for background location on its own —
 * `startLocationUpdatesAsync` just throws if it isn't already granted, so
 * permissions must be explicitly requested first on every real device.
 */
export async function startLocationTracking(attendanceId: string, checkedInAt: string) {
  const { foreground, background } = await requestLocationPermissions();
  if (!foreground) {
    // Previously threw, caught by the caller and only console.warn'd — the
    // employee saw check-in succeed with zero indication location sharing
    // never actually started. Now surfaced via the store instead, so a
    // visible warning can show wherever the app renders it (see
    // PresenceCard.tsx).
    useAttendanceSessionStore
      .getState()
      .setTrackingWarning(
        "Location permission was denied — your live location won't be shared. Enable location access for this app in your phone's Settings.",
      );
    return;
  }

  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(
    LOCATION_TRACKING_TASK,
  ).catch(() => false);

  if (!alreadyStarted) {
    try {
      await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK, {
        // GPS-grade accuracy (~10m) — the auto-pause feature (see
        // /api/kiosk/location's evaluatePauseState) needs to reliably tell
        // whether an employee is still inside a geofence that can be as tight
        // as a few tens of meters. Network/cell-based "Low" accuracy (~1-3km)
        // was tried first for battery savings, but is too coarse to ever
        // detect crossing a building-scale radius — it made auto-pause
        // effectively never trigger. This is a deliberate battery-vs-accuracy
        // tradeoff in favor of the pause feature actually working.
        accuracy: Location.Accuracy.High,
        timeInterval: PING_INTERVAL_MS,
        distanceInterval: 0,
        showsBackgroundLocationIndicator: true,
        pausesUpdatesAutomatically: false,
        foregroundService: {
          notificationTitle: "Attendance tracking is on",
          notificationBody: "Your location is being shared while you're checked in.",
        },
      });
    } catch {
      useAttendanceSessionStore
        .getState()
        .setTrackingWarning(
          "Location tracking couldn't start on this device. Try checking out and back in, or check your location settings.",
        );
      return;
    }
  }

  useAttendanceSessionStore.getState().startTracking(attendanceId, checkedInAt);

  if (!background) {
    useAttendanceSessionStore
      .getState()
      .setTrackingWarning(
        'Background location isn\'t allowed — sharing may stop when you leave the app. Set location permission to "Allow all the time" in Settings.',
      );
  }
}

export async function stopLocationTracking() {
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK).catch(
      () => false,
    );
    if (started) {
      await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK);
    }
  } catch {
    // Best-effort — the task may already be gone (e.g. never started
    // successfully in the first place). Never let this block a check-out.
  }
}

export async function isLocationTrackingActive(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(LOCATION_TRACKING_TASK).catch(() => false);
}

/**
 * Verifies the background task is still actually running while the store
 * thinks it should be — catches the case where it started fine but the OS
 * silently killed it later (aggressive battery optimization on some Android
 * OEM skins). Call on an interval from an always-mounted component (see
 * RootNavigator.tsx) while authenticated; a no-op when not checked in.
 */
export async function checkTrackingHealth(): Promise<void> {
  const session = useAttendanceSessionStore.getState();
  if (!session.isTracking) return;

  const active = await isLocationTrackingActive();
  if (active) {
    if (session.trackingWarning) session.setTrackingWarning(null);
    return;
  }

  session.setTrackingWarning(
    "Live location sharing has stopped unexpectedly. Check your location settings, or check out and back in to restart it.",
  );
}

/**
 * Called once on app startup. The "isTracking" flag is persisted to disk so
 * it survives app restarts, but it can go stale — e.g. if the native task
 * failed to start (no background-location entitlement in Expo Go, permission
 * revoked in Settings, etc.) after the flag had already been optimistically
 * set by an older build. Reconciles the persisted flag against the real
 * native state instead of trusting it blindly, and tries to resume a
 * genuinely active session so it survives a full app relaunch too.
 */
export async function reconcileLocationTrackingOnStartup() {
  const session = useAttendanceSessionStore.getState();
  if (!session.activeAttendanceId || !session.checkedInAt) return;

  try {
    await startLocationTracking(session.activeAttendanceId, session.checkedInAt);
  } catch (error) {
    console.warn("Could not resume location tracking on startup:", error);
    session.stopTracking();
  }
}
