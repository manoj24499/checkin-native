import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { AxiosError } from "axios";
import { fieldService } from "@/api/services";
import { useAuthStore } from "@/store/authStore";
import { useOfflineQueueStore } from "@/store/offlineQueueStore";
import { useVisitQueueStore, type VisitQueueItem } from "@/store/visitQueueStore";
import { loadOfflineQueue, newClientId, syncOfflineQueue } from "@/services/offlineQueue";
import type { FieldVisitRequest } from "@/types";

/**
 * Field-visit queue ("Log a visit", "+ Add a location", "Log this visit").
 *
 * A visit is saved on the phone the moment the worker taps Save and sent to
 * POST /api/mobile/field-visits in the background — with a `clientId`
 * (idempotency key: a resend after a crash or timeout never creates a second
 * visit) and `reachedAt` (when they tapped Save, so the server attaches it to
 * the Field check-in it happened during, even if sent much later). Same
 * storage layout as services/offlineQueue.ts:
 *  - metadata: one small JSON list in AsyncStorage (QUEUE_KEY);
 *  - photos: one AsyncStorage row each (kept under ~1.5 MB — Android rows over
 *    ~2 MB break).
 *
 * Sent strictly in order, one at a time, one run at a time. No signal / 5xx /
 * 408 / 429 / "check in first" (the offline check-in hasn't reached the
 * server yet) stop the run and leave everything "saving" for the next trigger
 * (see useOfflineQueueSync); any other rejection marks just that visit failed.
 */

const QUEUE_KEY = "checkin.visitQueue";
const PHOTO_PREFIX = "checkin.visitQueue.photo.";
const photoKey = (key: string) => `${PHOTO_PREFIX}${key}`;
// Comfortably under Android's ~2 MB AsyncStorage row limit (same cap as the check-in queue).
const MAX_PHOTO_CHARS = 1_500_000;
const PHOTO_TOO_LARGE = "This photo is too large to save on the phone. Remove this visit and log it again with a new photo.";
const PHOTO_MISSING = "The photo for this visit is no longer on the phone. Remove it and log the visit again.";

// Photos of visits saved during this run of the app — so sending doesn't need a storage read, and a
// visit whose photo couldn't be written (storage full) can still be sent while the app stays open.
const memPhotos = new Map<string, string>();
// Listed in memory but not saved to the list yet (their photo is still being written), so a
// persisted item always has its photo row.
const unpersisted = new Set<string>();

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

let loadPromise: Promise<void> | null = null;
let writeChain: Promise<void> = Promise.resolve();

function getItems(): VisitQueueItem[] {
  return useVisitQueueStore.getState().items;
}

/** Loads the saved visits into the store once per process (and drops photo rows nothing refers to). */
export function loadVisitQueue(): Promise<void> {
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(QUEUE_KEY);
        const parsed = raw ? (JSON.parse(raw) as VisitQueueItem[]) : [];
        const saved = Array.isArray(parsed) ? parsed : [];
        // Anything added in memory before the load finished stays (after the saved ones).
        const savedKeys = new Set(saved.map((i) => i.key));
        const items = [...saved, ...getItems().filter((i) => !savedKeys.has(i.key))];
        useVisitQueueStore.setState({ items });

        // A crash between writing a photo and listing its visit leaves an orphan photo row.
        const known = new Set(items.map((i) => photoKey(i.key)));
        const allKeys = await AsyncStorage.getAllKeys();
        const orphans = allKeys.filter((k) => k.startsWith(PHOTO_PREFIX) && !known.has(k));
        if (orphans.length > 0) await AsyncStorage.multiRemove(orphans);
      } catch {
        // Corrupt storage: start empty rather than crash.
      } finally {
        useVisitQueueStore.setState({ loaded: true });
      }
    })();
  }
  return loadPromise;
}

// Every write saves whatever the list is at that moment, chained so writes can't land out of order.
function setItems(items: VisitQueueItem[]): Promise<void> {
  useVisitQueueStore.setState({ items });
  writeChain = writeChain
    .then(() => {
      const latest = getItems().filter((i) => !unpersisted.has(i.key));
      return latest.length === 0 ? AsyncStorage.removeItem(QUEUE_KEY) : AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(latest));
    })
    .catch(() => {});
  return writeChain;
}

function updateItem(key: string, patch: Partial<VisitQueueItem>): Promise<void> {
  return setItems(getItems().map((i) => (i.key === key ? { ...i, ...patch } : i)));
}

async function deletePhoto(key: string): Promise<void> {
  memPhotos.delete(key);
  await AsyncStorage.removeItem(photoKey(key)).catch(() => {});
}

// ---------------------------------------------------------------------------
// Saving / retry / remove / wipe
// ---------------------------------------------------------------------------

/**
 * Saves one visit for `employeeCode` and lists it as "saving" right away. The
 * photo row is written before the visit is saved to the list. A photo too big
 * to store is refused (listed as failed, with the reason).
 */
export async function enqueueVisit(payload: FieldVisitRequest, employeeCode: string): Promise<VisitQueueItem> {
  await loadVisitQueue();
  const { photo, clientId: _ignoredClientId, reachedAt: _ignoredReachedAt, ...rest } = payload;
  const clientId = newClientId();
  const tooLarge = !!photo && photo.length > MAX_PHOTO_CHARS;
  const item: VisitQueueItem = {
    key: clientId,
    clientId,
    reachedAt: new Date().toISOString(),
    employeeCode,
    name: payload.name,
    status: tooLarge ? "failed" : "saving",
    error: tooLarge ? PHOTO_TOO_LARGE : undefined,
    attempts: 0,
    hasPhoto: !!photo,
    payload: rest,
  };

  if (tooLarge) {
    // Shown, but never saved: it can't be sent, and an oversized row would break storage.
    unpersisted.add(item.key);
    await setItems([...getItems(), item]);
    return item;
  }

  if (photo) {
    memPhotos.set(item.key, photo);
    unpersisted.add(item.key);
  }
  await setItems([...getItems(), item]);
  if (photo) {
    try {
      await AsyncStorage.setItem(photoKey(item.key), photo);
      unpersisted.delete(item.key);
      // Removed meanwhile (sent already, or by the employee): don't leave the photo behind.
      if (!getItems().some((i) => i.key === item.key)) await deletePhoto(item.key);
      else await setItems(getItems());
    } catch {
      // Storage full: still sent from memory while the app is open, just not kept across a restart.
      await AsyncStorage.removeItem(photoKey(item.key)).catch(() => {});
    }
  }
  return item;
}

export async function retryVisit(key: string): Promise<void> {
  await loadVisitQueue();
  const item = getItems().find((i) => i.key === key);
  if (!item || item.status !== "failed") return;
  if (item.error === PHOTO_TOO_LARGE) return; // Retrying can't fix this one.
  await updateItem(key, { status: "saving", error: undefined });
}

export async function removeVisit(key: string): Promise<void> {
  await loadVisitQueue();
  unpersisted.delete(key);
  await setItems(getItems().filter((i) => i.key !== key));
  await deletePhoto(key);
}

/** Sign-out: every saved visit and its photo goes (same as the offline check-in queue). */
export async function discardVisitQueue(): Promise<void> {
  await loadVisitQueue();
  const items = getItems();
  unpersisted.clear();
  await setItems([]);
  await Promise.all(items.map((i) => deletePhoto(i.key)));
  memPhotos.clear();
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const rows = allKeys.filter((k) => k.startsWith(PHOTO_PREFIX));
    if (rows.length > 0) await AsyncStorage.multiRemove(rows);
  } catch {
    // Best effort.
  }
}

/** Visits of this employee not sent yet (failed ones excluded). */
export function countWaitingVisits(items: VisitQueueItem[], employeeCode: string | undefined): number {
  return items.filter((i) => i.employeeCode === employeeCode && i.status === "saving").length;
}

export function hasWaitingVisits(): boolean {
  return getItems().some((i) => i.status === "saving");
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

type Outcome = { kind: "wait" } | { kind: "failed"; message: string };

function classify(error: unknown): Outcome {
  if (!(error instanceof AxiosError) || !error.response) return { kind: "wait" };
  const status = error.response.status;
  const data = (error.response.data ?? {}) as { error?: string };
  const message = data.error || "The server couldn't save this visit.";
  if (status >= 500 || status === 408 || status === 429) return { kind: "wait" };
  // Session refresh failed / in progress: the interceptor handles sign-out; keep the visit.
  if (status === 401) return { kind: "wait" };
  // No Field check-in on the server yet for that time — usually the offline check-in still on its
  // way. Kept waiting; the server turns it into a 422 once it's over 3 days old.
  if (status === 409 && /check in/i.test(message)) return { kind: "wait" };
  return { kind: "failed", message };
}

type SentListener = () => void;
const listeners = new Set<SentListener>();

/** Notified after a run that sent at least one visit (used to refresh react-query data). */
export function onVisitsSent(listener: SentListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// The offline check-in of this employee isn't on the server yet: a visit sent now would find no
// check-in to attach to.
function checkInStillQueued(employeeCode: string): boolean {
  return useOfflineQueueStore
    .getState()
    .items.some(
      (i) => i.employeeCode === employeeCode && i.action === "CHECK_IN" && (i.status === "pending" || i.status === "syncing"),
    );
}

let syncPromise: Promise<void> | null = null;
let rerunRequested = false;

/** Sends whatever visits are waiting. Safe to call from any trigger; concurrent calls share one run. */
export function syncVisitQueue(): Promise<void> {
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
      // Message only: an AxiosError's config carries the request body (photo included).
      console.warn("Visit queue sync failed:", error instanceof Error ? error.message : String(error));
    } finally {
      syncPromise = null;
    }
  })();
  return syncPromise;
}

/** Check-ins/outs first (a visit needs its check-in on the server), then visits. */
export async function syncAllQueues(): Promise<void> {
  await syncOfflineQueue();
  await syncVisitQueue();
}

async function runSync(): Promise<void> {
  await Promise.all([loadVisitQueue(), loadOfflineQueue()]);
  const auth = useAuthStore.getState();
  const employeeCode = auth.user?.employeeCode;
  // Signed out (or the session ended): pause until someone signs in again.
  if (auth.status !== "authenticated" || !employeeCode || !auth.accessToken) return;

  const mine = () => getItems().filter((i) => i.employeeCode === employeeCode && i.status === "saving");
  if (mine().length === 0) return;
  if (checkInStillQueued(employeeCode)) return;
  const net = await NetInfo.fetch().catch(() => null);
  if (net && net.isConnected === false) return;

  let sent = 0;
  for (;;) {
    if (useAuthStore.getState().status !== "authenticated") break;
    if (useAuthStore.getState().user?.employeeCode !== employeeCode) break;
    if (checkInStillQueued(employeeCode)) break;
    const item = mine()[0];
    if (!item) break;

    const photo = item.hasPhoto
      ? memPhotos.get(item.key) ?? (await AsyncStorage.getItem(photoKey(item.key)).catch(() => null))
      : "";
    if (photo === null || photo === undefined) {
      await updateItem(item.key, { status: "failed", error: PHOTO_MISSING });
      continue;
    }

    await updateItem(item.key, { attempts: item.attempts + 1 });
    try {
      await fieldService.logVisit({ ...item.payload, photo, clientId: item.clientId, reachedAt: item.reachedAt });
    } catch (error) {
      const outcome = classify(error);
      if (outcome.kind === "wait") break;
      // Removed by the employee mid-send: nothing to mark.
      if (getItems().some((i) => i.key === item.key)) {
        await updateItem(item.key, { status: "failed", error: outcome.message });
      }
      continue;
    }

    unpersisted.delete(item.key);
    await setItems(getItems().filter((i) => i.key !== item.key));
    await deletePhoto(item.key);
    sent++;
  }

  if (sent > 0) listeners.forEach((listener) => listener());
}
