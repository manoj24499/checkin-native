import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { locationService } from "@/api/services";
import { useAttendanceSessionStore } from "@/store/attendanceSessionStore";

export const LOCATION_TRACKING_TASK = "checkin-location-tracking";

// Tracks the last time tracking was (re)started, so callers elsewhere (see
// RootNavigator) can tell a genuine app background/foreground cycle apart
// from the transient active/inactive blip some Android OEM skins fire the
// instant the foreground-service notification for tracking is posted —
// mirrors msSinceLastBiometricPrompt() in services/biometrics.ts, which
// guards against the same class of blip from the biometric dialog itself.
let lastTrackingStartAt = 0;

export function msSinceLocationTrackingStart(): number {
  return Date.now() - lastTrackingStartAt;
}

// The admin dashboard marks an employee "Offline" once their last ping is
// older than LIVE_THRESHOLD_MS = 3 minutes (components/DashboardWorkspace.tsx
// in the backend project). Pinging slower than that guarantees the employee
// spends more time looking offline than live, so this must stay under 3
// minutes — 2 minutes leaves headroom for network latency/retries.
export const PING_INTERVAL_MS = 2 * 60 * 1000;

// Field workers are on the road, and distance is summed between recorded
// points: with only one point every 2 minutes, a vehicle at 40 km/h covers
// ~1.3 km between points and the straight line between them cuts every corner,
// so the total came out 10-15 km short on a long day. Field profiles therefore
// sample the GPS every FIELD_SAMPLE_INTERVAL_MS, keep the samples in memory,
// and upload them in one batch along with the regular 2-minute ping (which
// still drives live status and auto-pause on its own). Office/WFH profiles are
// unchanged — no extra battery or data use.
export const FIELD_SAMPLE_INTERVAL_MS = 10 * 1000;
// Everything waiting to reach the server (see the outbox below). ~3000 samples is ~8h of Field
// sampling at 10s; anything older than MAX_SAMPLE_AGE_MS is dropped so a phone that stays
// offline for days can't grow the stored list without limit.
const MAX_BUFFERED_SAMPLES = 3000;
const MAX_SAMPLE_AGE_MS = 3 * 24 * 60 * 60 * 1000;
const MAX_FLUSH_ROUNDS = 25;
const MAX_TRAIL_PER_PING = 120;

type TrailSample = { latitude: number; longitude: number; accuracy: number; timestamp: string };
// A sample plus the check-in session (attendanceId) it belongs to, so samples that were still
// waiting when a session ended (check-out) can be uploaded to the right session later.
type OutboxSample = TrailSample & { a: string };

// The outbox: every location reading that hasn't been confirmed by the server yet, oldest first.
// It is kept on disk, so nothing is lost if the phone has no signal, the app is killed, or the
// session ends before the upload succeeds — it goes out as soon as the server can be reached.
let outbox: OutboxSample[] = [];
let lastPingSentAt = 0;
let bufferLoaded = false;
let flushing = false;

const TRAIL_STORAGE_KEY = "checkin.trailBuffer";

// A check-in saved offline (see services/offlineQueue.ts) has no attendance id until it reaches
// the server, so tracking runs under a temporary "local-<clientId>" session id meanwhile. Samples
// for such a session are only ever buffered, never sent; once the check-in is recorded,
// remapOutboxSession() moves them to the real id and they go out like any other backlog.
export const LOCAL_SESSION_PREFIX = "local-";

export function isLocalSessionId(attendanceId: string | null | undefined): boolean {
  return !!attendanceId && attendanceId.startsWith(LOCAL_SESSION_PREFIX);
}

// temp id -> real id, for a sample the background task records under the temp id after the remap
// already ran (it may have read the session id just before the store switched over).
const remappedSessions = new Map<string, string>();

function sampleOf(l: Location.LocationObject): TrailSample {
  return {
    latitude: l.coords.latitude,
    longitude: l.coords.longitude,
    accuracy: l.coords.accuracy ?? 0,
    timestamp: new Date(l.timestamp).toISOString(),
  };
}

function strip({ latitude, longitude, accuracy, timestamp }: OutboxSample): TrailSample {
  return { latitude, longitude, accuracy, timestamp };
}

function pruneOutbox() {
  const cutoff = Date.now() - MAX_SAMPLE_AGE_MS;
  outbox = outbox.filter((s) => new Date(s.timestamp).getTime() >= cutoff);
  if (outbox.length > MAX_BUFFERED_SAMPLES) outbox = outbox.slice(-MAX_BUFFERED_SAMPLES);
}

async function loadOutbox() {
  if (bufferLoaded) return;
  bufferLoaded = true;
  try {
    const raw = await AsyncStorage.getItem(TRAIL_STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as (TrailSample & { a?: string })[];
    if (!Array.isArray(saved)) return;
    // Samples saved by older builds have no session id: they belong to the current session.
    const fallback = useAttendanceSessionStore.getState().activeAttendanceId ?? "";
    const known = new Set(outbox.map((s) => `${s.a}|${s.timestamp}`));
    const restored = saved
      .map((s) => ({ ...s, a: s.a ?? fallback }))
      .filter((s) => s.a && !known.has(`${s.a}|${s.timestamp}`));
    outbox = [...restored, ...outbox].sort((x, y) => x.timestamp.localeCompare(y.timestamp));
    pruneOutbox();
  } catch {
    // Best effort.
  }
}

function saveOutbox() {
  if (outbox.length === 0) {
    AsyncStorage.removeItem(TRAIL_STORAGE_KEY).catch(() => {});
    return;
  }
  AsyncStorage.setItem(TRAIL_STORAGE_KEY, JSON.stringify(outbox)).catch(() => {});
}

function addToOutbox(sessionId: string, sample: TrailSample) {
  const attendanceId = remappedSessions.get(sessionId) ?? sessionId;
  if (outbox.some((s) => s.a === attendanceId && s.timestamp === sample.timestamp)) return;
  outbox.push({ ...sample, a: attendanceId });
  pruneOutbox();
}

function removeFromOutbox(attendanceId: string, timestamps: string[]) {
  const done = new Set(timestamps);
  outbox = outbox.filter((s) => !(s.a === attendanceId && done.has(s.timestamp)));
}

function httpStatusOf(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}

/**
 * Moves every buffered sample of an offline check-in's temporary session to the real attendance id
 * once that check-in is recorded, so the next flush uploads them (with backfill, which the server
 * also accepts for a session that has already ended).
 */
export async function remapOutboxSession(tempId: string, realId: string): Promise<void> {
  remappedSessions.set(tempId, realId);
  await loadOutbox();
  const known = new Set(outbox.filter((s) => s.a === realId).map((s) => s.timestamp));
  outbox = outbox
    .filter((s) => !(s.a === tempId && known.has(s.timestamp)))
    .map((s) => (s.a === tempId ? { ...s, a: realId } : s));
  saveOutbox();
}

/** Drops a temporary session's samples — its offline check-in was cancelled or rejected. */
export async function dropOutboxSession(tempId: string): Promise<void> {
  await loadOutbox();
  outbox = outbox.filter((s) => s.a !== tempId);
  saveOutbox();
}

/**
 * Uploads everything waiting in the outbox, oldest first, in batches the server accepts. Safe to
 * call any time (it does nothing when empty or when a flush is already running, and the server
 * ignores samples it already has): after a successful live ping, when the network comes back,
 * and when a session ends. Stops at the first failure and leaves the rest stored for next time.
 */
export async function flushPendingLocations(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    await loadOutbox();
    for (let round = 0; round < MAX_FLUSH_ROUNDS; round++) {
      // Samples of an offline check-in that hasn't reached the server yet have nowhere to go.
      const next = outbox.find((s) => !isLocalSessionId(s.a));
      if (!next) break;
      const attendanceId = next.a;
      const batch = outbox.filter((s) => s.a === attendanceId).slice(0, MAX_TRAIL_PER_PING);
      const last = batch[batch.length - 1];
      try {
        await locationService.sendPing({
          attendanceId,
          latitude: last.latitude,
          longitude: last.longitude,
          accuracy: last.accuracy,
          timestamp: last.timestamp,
          trail: batch.map(strip),
          backfill: true,
        });
        removeFromOutbox(attendanceId, batch.map((s) => s.timestamp));
        saveOutbox();
      } catch (error) {
        const status = httpStatusOf(error);
        // The server understood the request and will never accept it (unknown session, bad data):
        // drop that session's samples instead of retrying forever. Anything else (no signal,
        // timeout, 5xx, rate limit) keeps them for the next attempt — and so do 401 (the login
        // expired and no tracking token was accepted) and 403 (not allowed for this session right
        // now, e.g. its tracking token isn't saved yet): those can clear up, so retry later.
        const retryLater = status === 401 || status === 403 || status === 408 || status === 429;
        if (status && status >= 400 && status < 500 && !retryLater) {
          outbox = outbox.filter((s) => s.a !== attendanceId);
          saveOutbox();
          continue;
        }
        break;
      }
    }
  } finally {
    flushing = false;
  }
}

function isFieldProfile(): boolean {
  // Loaded lazily: authStore itself imports this module (to stop tracking on
  // sign-out), so a top-level import here would be a circular dependency.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useAuthStore } = require("@/store/authStore") as typeof import("@/store/authStore");
  return useAuthStore.getState().user?.workMode === "FIELD";
}

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
  // A mocked fix is dropped rather than reported — if every subsequent fix is
  // also mocked, the employee simply ages past the admin dashboard's 3-minute
  // "Live" threshold and shows as Offline, which is a more honest signal than
  // a spoofed location.
  const real = locations.filter((l) => !l.mocked);
  const latest = real[real.length - 1];
  if (!latest) {
    if (locations.length > 0) console.warn("Skipping location ping — mock location detected");
    return;
  }

  const field = isFieldProfile();
  await loadOutbox();
  if (isLocalSessionId(attendanceId)) {
    // Offline check-in not recorded yet: there is no session on the server to ping. Just keep the
    // readings (every one for Field, the latest otherwise — same density as the online path).
    for (const l of field ? real : [latest]) addToOutbox(attendanceId, sampleOf(l));
    saveOutbox();
    return;
  }
  if (field) {
    // Field profiles record every sample into the outbox as it arrives (so the route survives a
    // crash or a dead zone), and upload them in batches along with the regular 2-minute ping.
    for (const l of real) addToOutbox(attendanceId, sampleOf(l));
    saveOutbox();
    // Samples arrive every ~15s but the server only needs a ping every ~2 min.
    const due = Date.now() - lastPingSentAt >= PING_INTERVAL_MS - 5_000;
    const waiting = outbox.filter((s) => s.a === attendanceId).length;
    if (!due && waiting < MAX_TRAIL_PER_PING) return;
  }

  const latestSample = sampleOf(latest);
  // Oldest waiting samples go out first, so a long outage drains in order instead of keeping
  // only the newest ones.
  const batch = outbox
    .filter((s) => s.a === attendanceId && s.timestamp !== latestSample.timestamp)
    .slice(0, MAX_TRAIL_PER_PING);
  try {
    const result = await locationService.sendPing({
      attendanceId,
      latitude: latest.coords.latitude,
      longitude: latest.coords.longitude,
      accuracy: latest.coords.accuracy ?? 0,
      timestamp: latestSample.timestamp,
      ...(batch.length > 0 ? { trail: batch.map(strip) } : {}),
    });
    // Only what the server just confirmed leaves the outbox — never the whole list.
    removeFromOutbox(attendanceId, [...batch.map((s) => s.timestamp), latestSample.timestamp]);
    if (field) lastPingSentAt = Date.now();
    saveOutbox();
    if (!result.tracking) {
      await stopLocationTracking();
      useAttendanceSessionStore.getState().stopTracking();
      return;
    }
    // Signal is back: send whatever else piled up while it was down.
    await flushPendingLocations();
  } catch {
    // No signal / server unreachable. Keep the reading (Field profiles already hold it in the
    // outbox) so it is uploaded later instead of being lost.
    if (!field) {
      addToOutbox(attendanceId, latestSample);
      saveOutbox();
    }
  }
});

/**
 * Only invokes the OS's *request* permission flow when permission isn't
 * already granted — checked first via the passive get*PermissionsAsync
 * calls. This function runs on every foreground transition (see App.tsx's
 * reconcileLocationTrackingOnStartup wiring), which on a checked-in device
 * is almost always the "already granted, nothing to do" case. Calling the
 * active request*PermissionsAsync APIs unconditionally in that case is
 * itself a known trigger for a transient background/active blip on some
 * Android OEM skins (MIUI/HyperOS in particular) — which, left unguarded,
 * re-triggers this very function on the next foreground event, becoming a
 * self-sustaining flicker loop instead of a one-off check.
 */
export async function requestLocationPermissions(): Promise<{
  foreground: boolean;
  background: boolean;
}> {
  let foreground = await Location.getForegroundPermissionsAsync();
  if (foreground.status !== "granted") {
    foreground = await Location.requestForegroundPermissionsAsync();
  }
  if (foreground.status !== "granted") {
    return { foreground: false, background: false };
  }

  let background = await Location.getBackgroundPermissionsAsync();
  if (background.status !== "granted") {
    background = await Location.requestBackgroundPermissionsAsync();
  }
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
  lastTrackingStartAt = Date.now();
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
        timeInterval: isFieldProfile() ? FIELD_SAMPLE_INTERVAL_MS : PING_INTERVAL_MS,
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
  lastPingSentAt = 0;
  // Try to upload anything still waiting before the session is gone (brief, best effort). What
  // can't be sent stays stored and goes out later; it is never discarded here.
  await Promise.race([flushPendingLocations(), new Promise<void>((resolve) => setTimeout(resolve, 6_000))]).catch(
    () => {},
  );
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

  // The OS stopped the background task. While the app is open, try to start it again by
  // itself; only warn the employee if that fails (permission gone, battery saver, ...).
  if (AppState.currentState === "active" && session.activeAttendanceId && session.checkedInAt) {
    await startLocationTracking(session.activeAttendanceId, session.checkedInAt);
    if (await isLocationTrackingActive()) return;
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
