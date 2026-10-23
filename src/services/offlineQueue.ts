import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import NetInfo from "@react-native-community/netinfo";
import { AxiosError } from "axios";
import { attendanceService, employeeService } from "@/api/services";
import { isWallClockTrusted, recoverSession } from "@/api/client";
import {
  LOCAL_SESSION_PREFIX,
  dropOutboxSession,
  flushPendingLocations,
  isLocalSessionId,
  remapOutboxSession,
  startLocationTracking,
  stopLocationTracking,
} from "@/services/locationTracking";
import { saveTrackingToken } from "@/services/trackingTokens";
import { useAttendanceSessionStore } from "@/store/attendanceSessionStore";
import { useAuthStore } from "@/store/authStore";
import {
  useOfflineQueueStore,
  type CachedKioskStatus,
  type OfflineConfig,
  type OfflineQueueItem,
} from "@/store/offlineQueueStore";
import type { KioskStatus, ScanRequest, ScanResult } from "@/types";

/**
 * Offline check-in/check-out queue.
 *
 * When the phone has no connection (and the organization allows it — see
 * KioskStatus.offlineCheckInEnabled), a check-in/out is saved here instead of
 * failing, and sent to the same /api/kiosk/scan endpoint later with an
 * `offline` block (clientId = idempotency key, capturedAt = when it
 * happened). Where each part lives:
 *  - metadata: one small JSON list in AsyncStorage (QUEUE_KEY);
 *  - photos: one AsyncStorage row each (~100-300 KB after PhotoCaptureView's
 *    resize — well under Android's ~2 MB row limit; expo-file-system isn't a
 *    direct dependency of this app, so files aren't an option without one);
 *  - the PIN: SecureStore only, one key per attempt, deleted the moment the
 *    attempt is sent, rejected or discarded. It never touches AsyncStorage,
 *    logs, the react-query cache or a persisted store.
 *
 * Items are sent strictly in order, one at a time. A temporary error (no
 * signal, 5xx, 408, 429) stops the run and leaves everything for the next
 * trigger; a permanent rejection marks just that item failed.
 */

const QUEUE_KEY = "checkin.offlineQueue";
const CONFIG_KEY = "checkin.offlineConfig";
const LAST_STATUS_KEY = "checkin.lastKioskStatus";
export const DEFAULT_OFFLINE_MAX_AGE_MINUTES = 360;
// Comfortably under Android's ~2 MB AsyncStorage row limit.
const MAX_PHOTO_CHARS = 1_500_000;

const TOO_OLD_MESSAGE = "This check-in is too old to send automatically. Ask your admin to add it manually.";

type PhotoKind = "photo" | "overtimePhoto";
const photoKey = (clientId: string, kind: PhotoKind) => `checkin.offlineQueue.${kind}.${clientId}`;
const pinKey = (clientId: string) => `checkin.offlinePin.${clientId}`;
export const localSessionIdFor = (clientId: string) => `${LOCAL_SESSION_PREFIX}${clientId}`;

export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

// UUID v4 shape. Math.random is fine here: this is an idempotency key, not a
// secret (no crypto module is installed).
function newClientId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

let loadPromise: Promise<void> | null = null;
let writeChain: Promise<void> = Promise.resolve();

/** Loads the queue (and cached config/status) into the store once per process. */
export function loadOfflineQueue(): Promise<void> {
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const [rawItems, rawConfig, rawStatus] = await Promise.all([
          AsyncStorage.getItem(QUEUE_KEY),
          AsyncStorage.getItem(CONFIG_KEY),
          AsyncStorage.getItem(LAST_STATUS_KEY),
        ]);
        const saved = rawItems ? (JSON.parse(rawItems) as OfflineQueueItem[]) : [];
        // A send interrupted by the app being killed: the server either got it (a resend is an
        // idempotent replay) or didn't — both are safe to retry.
        const items = (Array.isArray(saved) ? saved : []).map((i) =>
          i.status === "syncing" ? { ...i, status: "pending" as const } : i,
        );
        useOfflineQueueStore.setState({
          items,
          config: rawConfig ? (JSON.parse(rawConfig) as OfflineConfig) : null,
          lastStatus: rawStatus ? (JSON.parse(rawStatus) as CachedKioskStatus) : null,
        });
      } catch {
        // Corrupt storage: start empty rather than crash.
      } finally {
        useOfflineQueueStore.setState({ loaded: true });
      }
    })();
  }
  return loadPromise;
}

function getItems(): OfflineQueueItem[] {
  return useOfflineQueueStore.getState().items;
}

// Every write saves whatever the list is at that moment, chained so writes can't land out of order.
function setItems(items: OfflineQueueItem[]): Promise<void> {
  useOfflineQueueStore.setState({ items });
  writeChain = writeChain
    .then(() => {
      const latest = getItems();
      return latest.length === 0 ? AsyncStorage.removeItem(QUEUE_KEY) : AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(latest));
    })
    .catch(() => {});
  return writeChain;
}

function updateItem(clientId: string, patch: Partial<OfflineQueueItem>): Promise<void> {
  return setItems(getItems().map((i) => (i.clientId === clientId ? { ...i, ...patch } : i)));
}

async function deleteSecrets(clientId: string): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(pinKey(clientId)).catch(() => {}),
    AsyncStorage.removeItem(photoKey(clientId, "photo")).catch(() => {}),
    AsyncStorage.removeItem(photoKey(clientId, "overtimePhoto")).catch(() => {}),
  ]);
}

// ---------------------------------------------------------------------------
// Server status / config cache
// ---------------------------------------------------------------------------

/**
 * Called with every status the server returns (see useAttendanceStatus): keeps
 * the organization's offline setting and today's status available while offline.
 */
export function rememberKioskStatus(employeeCode: string, status: KioskStatus): void {
  const config: OfflineConfig = {
    employeeCode,
    enabled: status.exists ? status.offlineCheckInEnabled === true : false,
    maxAgeMinutes:
      status.exists && typeof status.offlineMaxAgeMinutes === "number" && status.offlineMaxAgeMinutes > 0
        ? status.offlineMaxAgeMinutes
        : DEFAULT_OFFLINE_MAX_AGE_MINUTES,
  };
  const lastStatus: CachedKioskStatus = { employeeCode, dateKey: localDateKey(new Date()), status };
  useOfflineQueueStore.setState({ config, lastStatus });
  AsyncStorage.multiSet([
    [CONFIG_KEY, JSON.stringify(config)],
    [LAST_STATUS_KEY, JSON.stringify(lastStatus)],
  ]).catch(() => {});
}

/** Offline saving is on only when the last status fetched for this employee said so. */
export function isOfflineCheckInEnabled(employeeCode: string | undefined): boolean {
  const config = useOfflineQueueStore.getState().config;
  return !!employeeCode && config?.employeeCode === employeeCode && config.enabled;
}

function maxAgeMs(): number {
  return (useOfflineQueueStore.getState().config?.maxAgeMinutes ?? DEFAULT_OFFLINE_MAX_AGE_MINUTES) * 60_000;
}

// ---------------------------------------------------------------------------
// Saving an attempt
// ---------------------------------------------------------------------------

export interface EnqueueInput {
  payload: ScanRequest;
  pinUnverified: boolean;
}

/**
 * Saves one check-in/out attempt. The PIN goes to SecureStore and the photos
 * to their own rows before the item itself is listed, so a listed item always
 * has everything it needs. Location-tracking side effects are the caller's
 * (see useSaveOfflineAttempt), mirroring useCheckInOut.
 */
export async function enqueueOfflineAttempt({ payload, pinUnverified }: EnqueueInput): Promise<OfflineQueueItem> {
  await loadOfflineQueue();
  for (const photo of [payload.photo, payload.overtimeSummaryPhoto]) {
    if (photo && photo.length > MAX_PHOTO_CHARS) {
      throw new Error("This photo is too large to save on the phone. Retake it and try again.");
    }
  }

  const clientId = newClientId();
  const now = new Date();
  const session = useAttendanceSessionStore.getState();
  const item: OfflineQueueItem = {
    clientId,
    action: payload.action,
    employeeCode: payload.employeeCode,
    capturedAt: now.toISOString(),
    timeVerified: isWallClockTrusted(),
    latitude: payload.latitude,
    longitude: payload.longitude,
    mocked: payload.mocked,
    checkInMode: payload.checkInMode,
    odometerKm: payload.odometerKm,
    overtimeSummary: payload.overtimeSummary,
    hasPhoto: !!payload.photo,
    hasOvertimePhoto: !!payload.overtimeSummaryPhoto,
    pinUnverified,
    resumeSession:
      payload.action === "CHECK_OUT" && session.activeAttendanceId && session.checkedInAt
        ? { attendanceId: session.activeAttendanceId, checkedInAt: session.checkedInAt }
        : null,
    status: "pending",
    attempts: 0,
    createdAt: now.toISOString(),
  };

  try {
    await SecureStore.setItemAsync(pinKey(clientId), payload.pin);
    if (payload.photo) await AsyncStorage.setItem(photoKey(clientId, "photo"), payload.photo);
    if (payload.overtimeSummaryPhoto) {
      await AsyncStorage.setItem(photoKey(clientId, "overtimePhoto"), payload.overtimeSummaryPhoto);
    }
  } catch {
    await deleteSecrets(clientId);
    throw new Error("Couldn't save this on the phone. Free up some storage and try again.");
  }

  await setItems([...getItems(), item]);
  return item;
}

// ---------------------------------------------------------------------------
// Cancel / dismiss / wipe
// ---------------------------------------------------------------------------

async function forgetLocalSession(clientId: string): Promise<void> {
  const tempId = localSessionIdFor(clientId);
  await dropOutboxSession(tempId);
  if (useAttendanceSessionStore.getState().activeAttendanceId === tempId) {
    await stopLocationTracking().catch(() => {});
    useAttendanceSessionStore.getState().stopTracking();
  }
}

/**
 * Cancels a still-pending item (and, for a check-in, the check-out queued
 * after it — that one could never be recorded without it).
 */
export async function cancelOfflineItem(clientId: string, opts?: { liveLocationEnabled?: boolean }): Promise<void> {
  await loadOfflineQueue();
  const items = getItems();
  const index = items.findIndex((i) => i.clientId === clientId);
  const item = items[index];
  if (!item || item.status !== "pending") return;

  const doomed = [item];
  if (item.action === "CHECK_IN") {
    const next = items.slice(index + 1).find((i) => i.employeeCode === item.employeeCode);
    if (next?.action === "CHECK_OUT" && next.status === "pending") doomed.push(next);
  }
  const ids = new Set(doomed.map((i) => i.clientId));
  await setItems(items.filter((i) => !ids.has(i.clientId)));
  await Promise.all(doomed.map((i) => deleteSecrets(i.clientId)));

  if (item.action === "CHECK_IN") {
    await forgetLocalSession(item.clientId);
  } else if (item.resumeSession && opts?.liveLocationEnabled) {
    // Cancelled check-out: the employee is still checked in, so resume sharing — unless that
    // session was an offline check-in that has since been sent (its temp id means nothing now).
    const resume = item.resumeSession;
    const stillLocal = isLocalSessionId(resume.attendanceId);
    const checkInStillQueued = getItems().some((i) => localSessionIdFor(i.clientId) === resume.attendanceId);
    if (!stillLocal || checkInStillQueued) {
      await startLocationTracking(resume.attendanceId, resume.checkedInAt).catch(() => {});
    }
  }
}

/** Removes a failed / already-recorded item from the list (its secrets are already gone). */
export async function dismissOfflineItem(clientId: string): Promise<void> {
  await loadOfflineQueue();
  const item = getItems().find((i) => i.clientId === clientId);
  if (!item || item.status === "pending" || item.status === "syncing") return;
  await setItems(getItems().filter((i) => i.clientId !== clientId));
  await deleteSecrets(clientId);
}

/** Sign-out: everything saved for this phone's employee goes, PINs and photos included. */
export async function discardOfflineQueue(): Promise<void> {
  await loadOfflineQueue();
  const items = getItems();
  await setItems([]);
  await Promise.all(items.map((i) => deleteSecrets(i.clientId)));
  await Promise.all(items.map((i) => dropOutboxSession(localSessionIdFor(i.clientId))));
  useOfflineQueueStore.setState({ config: null, lastStatus: null, notice: null });
  await AsyncStorage.multiRemove([CONFIG_KEY, LAST_STATUS_KEY]).catch(() => {});
}

// Attempts saved by a different employee can never be sent (the server only accepts an offline
// upload with the employee's own sign-in), and must not linger with their PIN on a shared phone.
async function purgeOtherEmployees(employeeCode: string): Promise<void> {
  const others = getItems().filter((i) => i.employeeCode !== employeeCode);
  if (others.length === 0) return;
  await setItems(getItems().filter((i) => i.employeeCode === employeeCode));
  await Promise.all(others.map((i) => deleteSecrets(i.clientId)));
  await Promise.all(others.map((i) => dropOutboxSession(localSessionIdFor(i.clientId))));
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

type Outcome =
  | { kind: "retry" }
  | { kind: "auth" }
  | { kind: "already"; message: string }
  | { kind: "failed"; message: string; code?: string };

function classify(error: unknown): Outcome {
  if (!(error instanceof AxiosError) || !error.response) return { kind: "retry" };
  const status = error.response.status;
  const data = (error.response.data ?? {}) as { error?: string; code?: string };
  const message = data.error || "The server couldn't record this.";
  if (status >= 500 || status === 408 || status === 429) return { kind: "retry" };
  // No/expired bearer token: refresh the session and try again (see runSync).
  if (status === 403 && data.code === "OFFLINE_AUTH") return { kind: "auth" };
  if (status === 409 && /already checked (in|out)/i.test(message)) return { kind: "already", message };
  if (status === 422 && data.code === "OFFLINE_TOO_OLD") return { kind: "failed", message: data.error || TOO_OLD_MESSAGE, code: data.code };
  return { kind: "failed", message, code: data.code };
}

async function markFailed(item: OfflineQueueItem, message: string, code?: string): Promise<void> {
  await updateItem(item.clientId, { status: "failed", errorMessage: message, errorCode: code });
  await deleteSecrets(item.clientId);
  if (item.action === "CHECK_IN") await forgetLocalSession(item.clientId);
}

/** The offline check-in now has a real attendance id: move tracking and its buffered samples over. */
async function linkRecordedCheckIn(item: OfflineQueueItem, attendanceId: string, timestamp: string): Promise<void> {
  const tempId = localSessionIdFor(item.clientId);
  const session = useAttendanceSessionStore.getState();
  if (session.activeAttendanceId === tempId) {
    useAttendanceSessionStore.setState({ activeAttendanceId: attendanceId, checkedInAt: timestamp });
  }
  await remapOutboxSession(tempId, attendanceId);
  void flushPendingLocations();
}

// "Already checked in": find the check-in the server has, so the buffered route still reaches it.
async function linkExistingCheckIn(item: OfflineQueueItem): Promise<void> {
  try {
    const { records } = await employeeService.getAttendanceHistory({ take: 10 });
    const day = localDateKey(new Date(item.capturedAt));
    const match = records.find((r) => r.type === "CHECK_IN" && localDateKey(new Date(r.timestamp)) === day);
    if (match) {
      await linkRecordedCheckIn(item, match.id, match.timestamp);
      return;
    }
  } catch {
    // Fall through: the samples can't be attributed.
  }
  await forgetLocalSession(item.clientId);
}

type SyncListener = (summary: { sent: ScanResult[]; failed: number }) => void;
const listeners = new Set<SyncListener>();

/** Notified after a run that changed anything (used to refresh react-query data). */
export function onOfflineQueueSynced(listener: SyncListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function hasPendingOfflineItems(): boolean {
  return getItems().some((i) => i.status === "pending" || i.status === "syncing");
}

let syncPromise: Promise<void> | null = null;
let rerunRequested = false;

/** Sends whatever is waiting. Safe to call from any trigger; concurrent calls share one run. */
export function syncOfflineQueue(): Promise<void> {
  if (syncPromise) {
    rerunRequested = true;
    return syncPromise;
  }
  syncPromise = (async () => {
    try {
      do {
        rerunRequested = false;
        await runSync();
      } while (rerunRequested);
    } catch (error) {
      // Message only: an AxiosError's config carries the request body, PIN included.
      console.warn("Offline queue sync failed:", error instanceof Error ? error.message : String(error));
    } finally {
      syncPromise = null;
    }
  })();
  return syncPromise;
}

async function runSync(): Promise<void> {
  await loadOfflineQueue();
  const auth = useAuthStore.getState();
  const employeeCode = auth.user?.employeeCode;
  // Signed out (or the session ended): pause until someone signs in again.
  if (auth.status !== "authenticated" || !employeeCode || !auth.accessToken) return;
  await purgeOtherEmployees(employeeCode);

  const sent: ScanResult[] = [];
  let failed = 0;
  let triedSessionRecovery = false;

  // Too old for the server to accept: never sent, and not kept as pending — even while offline.
  for (const item of getItems()) {
    if (item.status === "pending" && Date.now() - new Date(item.capturedAt).getTime() > maxAgeMs()) {
      await markFailed(item, TOO_OLD_MESSAGE, "OFFLINE_TOO_OLD");
      failed++;
    }
  }

  const net = hasPendingOfflineItems() ? await NetInfo.fetch().catch(() => null) : null;
  const canSend = hasPendingOfflineItems() && !(net && net.isConnected === false);

  for (;;) {
    if (!canSend) break;
    // Signed out mid-run (e.g. the session was rejected): pause, keep everything.
    if (useAuthStore.getState().status !== "authenticated") break;
    const items = getItems();
    const index = items.findIndex((i) => i.status === "pending");
    if (index === -1) break;
    const item = items[index];

    if (Date.now() - new Date(item.capturedAt).getTime() > maxAgeMs()) {
      await markFailed(item, TOO_OLD_MESSAGE, "OFFLINE_TOO_OLD");
      failed++;
      continue;
    }

    // A check-out depends on the check-in saved before it: if that one was rejected, so is this.
    if (item.action === "CHECK_OUT") {
      const previous = items
        .slice(0, index)
        .reverse()
        .find((i) => i.employeeCode === item.employeeCode);
      if (previous?.action === "CHECK_IN" && previous.status === "failed") {
        await markFailed(item, "Not sent: the offline check-in before it couldn't be recorded.");
        failed++;
        continue;
      }
    }

    const pin = await SecureStore.getItemAsync(pinKey(item.clientId)).catch(() => null);
    const photo = item.hasPhoto ? await AsyncStorage.getItem(photoKey(item.clientId, "photo")).catch(() => null) : null;
    const overtimePhoto = item.hasOvertimePhoto
      ? await AsyncStorage.getItem(photoKey(item.clientId, "overtimePhoto")).catch(() => null)
      : null;
    if (!pin || (item.hasPhoto && !photo)) {
      await markFailed(item, "The saved details for this are no longer on the phone, so it couldn't be sent.");
      failed++;
      continue;
    }

    await updateItem(item.clientId, { status: "syncing", attempts: item.attempts + 1 });
    let result: ScanResult;
    try {
      result = await attendanceService.scan({
        employeeCode: item.employeeCode,
        pin,
        action: item.action,
        photo: photo ?? undefined,
        latitude: item.latitude,
        longitude: item.longitude,
        mocked: item.mocked,
        checkInMode: item.checkInMode,
        odometerKm: item.odometerKm,
        overtimeSummary: item.overtimeSummary,
        overtimeSummaryPhoto: overtimePhoto ?? undefined,
        offline: { clientId: item.clientId, capturedAt: item.capturedAt, timeVerified: item.timeVerified },
      });
    } catch (error) {
      const outcome = classify(error);
      if (outcome.kind === "retry") {
        await updateItem(item.clientId, { status: "pending" });
        break;
      }
      if (outcome.kind === "auth") {
        await updateItem(item.clientId, { status: "pending" });
        if (triedSessionRecovery) {
          await markFailed(item, "This was saved by a different sign-in and can't be sent from this one.", "OFFLINE_AUTH");
          failed++;
          continue;
        }
        triedSessionRecovery = true;
        const recovered = await recoverSession().catch(() => "offline" as const);
        if (recovered === "refreshed") continue;
        // Offline again, or signed out: keep everything and wait.
        break;
      }
      if (outcome.kind === "already") {
        await updateItem(item.clientId, { status: "already_recorded", errorMessage: outcome.message });
        await deleteSecrets(item.clientId);
        if (item.action === "CHECK_IN") await linkExistingCheckIn(item);
        continue;
      }
      if (outcome.code === "OFFLINE_DISABLED") {
        const config = useOfflineQueueStore.getState().config;
        if (config) useOfflineQueueStore.setState({ config: { ...config, enabled: false } });
      }
      await markFailed(item, outcome.message, outcome.code);
      failed++;
      continue;
    }

    // Under the REAL attendance id, and before linkRecordedCheckIn remaps the outbox and flushes it,
    // so the backlog upload already carries the token.
    if (item.action === "CHECK_IN" && result.trackingToken) {
      await saveTrackingToken(result.id, result.trackingToken).catch(() => {});
    }
    await setItems(getItems().filter((i) => i.clientId !== item.clientId));
    await deleteSecrets(item.clientId);
    if (item.action === "CHECK_IN") await linkRecordedCheckIn(item, result.id, result.timestamp);
    sent.push(result);
  }

  if (sent.length > 0 || failed > 0) {
    useOfflineQueueStore.getState().setNotice(buildNotice(sent, failed));
    listeners.forEach((listener) => listener({ sent, failed }));
  }
}

function buildNotice(sent: ScanResult[], failed: number) {
  const parts: string[] = [];
  if (sent.length === 1) {
    parts.push(`Your offline ${sent[0].type === "CHECK_IN" ? "check-in" : "check-out"} was recorded.`);
  } else if (sent.length > 1) {
    parts.push(`${sent.length} offline check-ins/outs were recorded.`);
  }
  if (sent.some((r) => r.offlineOutsideArea)) {
    parts.push("It was outside your work area, so your admin will review it.");
  }
  if (failed > 0) {
    parts.push(`${failed} couldn't be recorded — see below.`);
  }
  return { tone: failed > 0 ? ("warning" as const) : ("success" as const), message: parts.join(" ") };
}
