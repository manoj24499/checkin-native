import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Per-session tracking tokens for /api/kiosk/location.
 *
 * Every successful CHECK_IN returns a random `trackingToken` exactly once (see ScanResult). Each
 * location upload for that attendance must send it as `X-Tracking-Token` (see
 * locationService.sendPing) — unlike the 15-minute access token, it doesn't expire while the app
 * sits in the background. Kept per attendance id, and deliberately NOT removed at check-out: the
 * location outbox (services/locationTracking.ts) may still upload samples for an ended session
 * later. Entries older than MAX_AGE_MS are pruned (the outbox drops samples at the same age).
 *
 * Tokens are secrets: never log them.
 */

const STORAGE_KEY = "checkin.trackingTokens";
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

type Entry = { token: string; savedAt: number };
type TokenMap = Record<string, Entry>;

// In-memory copy so the headless background location task can read a token without hitting
// storage on every ping. Loaded from AsyncStorage once per process.
let cache: TokenMap = {};
let loadPromise: Promise<void> | null = null;
let writeChain: Promise<void> = Promise.resolve();

function load(): Promise<void> {
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw) as unknown;
        if (!saved || typeof saved !== "object" || Array.isArray(saved)) return;
        const restored: TokenMap = {};
        for (const [id, entry] of Object.entries(saved as Record<string, Partial<Entry>>)) {
          if (entry && typeof entry.token === "string" && typeof entry.savedAt === "number") {
            restored[id] = { token: entry.token, savedAt: entry.savedAt };
          }
        }
        // Anything saved in this process before the load finished wins.
        cache = { ...restored, ...cache };
      } catch {
        // Corrupt storage: start empty (uploads fall back to the bearer token).
      }
    })();
  }
  return loadPromise;
}

function persist(): Promise<void> {
  writeChain = writeChain
    .then(() =>
      Object.keys(cache).length === 0
        ? AsyncStorage.removeItem(STORAGE_KEY)
        : AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache)),
    )
    .catch(() => {});
  return writeChain;
}

function dropExpired(): boolean {
  const cutoff = Date.now() - MAX_AGE_MS;
  let changed = false;
  for (const [id, entry] of Object.entries(cache)) {
    if (entry.savedAt < cutoff) {
      delete cache[id];
      changed = true;
    }
  }
  return changed;
}

/** Stores the token returned by a CHECK_IN under its (real) attendance id. */
export async function saveTrackingToken(attendanceId: string, token: string): Promise<void> {
  if (!attendanceId || !token) return;
  await load();
  cache[attendanceId] = { token, savedAt: Date.now() };
  dropExpired();
  await persist();
}

/** The saved token for this attendance id, or null (the upload then relies on the bearer token). */
export async function getTrackingToken(attendanceId: string): Promise<string | null> {
  if (!attendanceId) return null;
  const hit = cache[attendanceId];
  if (hit) return hit.token;
  await load();
  return cache[attendanceId]?.token ?? null;
}

/** Drops tokens older than 3 days. */
export async function pruneTrackingTokens(): Promise<void> {
  await load();
  if (dropExpired()) await persist();
}
