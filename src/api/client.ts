import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { env } from "@/config/env";
import { isNetworkError } from "@/utils/errors";

declare module "axios" {
  export interface AxiosRequestConfig {
    _isRefreshCall?: boolean;
  }
  export interface InternalAxiosRequestConfig {
    _isRetry?: boolean;
    _isRefreshCall?: boolean;
  }
}

// Only these paths carry a bearer session — everything else (kiosk/* check-in,
// login) authenticates the *request payload* itself (PIN/QR/refresh token),
// so a 401 from them is a business-logic rejection, not an expired session.
const SESSION_PROTECTED_PREFIXES = [
  "/api/mobile/me",
  "/api/mobile/change-pin",
  "/api/mobile/field-visits",
];

/**
 * The transport layer never imports the auth store directly (that would be a
 * circular import: store -> auth service -> this client). Instead the store
 * registers itself here once at startup via `setApiAuthContext`.
 */
interface ApiAuthContext {
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<string | null>;
  onSessionExpired: () => void;
}

let authContext: ApiAuthContext | null = null;

export function setApiAuthContext(ctx: ApiAuthContext) {
  authContext = ctx;
}

export const apiClient = axios.create({
  baseURL: env.apiUrl,
  timeout: 15_000,
  headers: {
    "Content-Type": "application/json",
    // Free-tier ngrok serves an HTML interstitial (with a 200 status) instead
    // of forwarding to the local dev server unless this header is present.
    // Harmless against non-ngrok backends — they simply ignore it.
    "ngrok-skip-browser-warning": "true",
  },
});

apiClient.interceptors.request.use((config) => {
  const token = authContext?.getAccessToken();
  if (token && !config._isRefreshCall) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

function refreshAccessTokenOnce(): Promise<string | null> {
  if (!authContext) return Promise.resolve(null);
  if (!refreshPromise) {
    refreshPromise = authContext.refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/**
 * Trusted-time anchor for offline check-ins (see services/offlineQueue.ts).
 * Every response the server actually sent carries its own clock in the
 * `Date` header; remembering it together with the phone's wall clock and its
 * monotonic clock (performance.now(), which the user can't change) at that
 * moment lets a later offline capture tell whether the wall clock was moved
 * since: both clocks should have advanced by the same amount. Only the
 * in-memory anchor from *this* process counts for that check (the monotonic
 * clock restarts with the process); the persisted copy is kept for
 * diagnostics only.
 */
export interface ServerTimeAnchor {
  serverMs: number;
  wallMs: number;
  perfMs: number;
}

const TIME_ANCHOR_STORAGE_KEY = "checkin.serverTimeAnchor";
// Second-resolution header + network latency; anything past this means the
// wall clock was changed (or the device slept, see isWallClockTrusted).
const MAX_CLOCK_DRIFT_MS = 2 * 60 * 1000;
let timeAnchor: ServerTimeAnchor | null = null;
let lastAnchorPersistedAt = 0;

function recordServerTime(response: AxiosResponse) {
  const header = response.headers?.["date"];
  const serverMs = typeof header === "string" ? Date.parse(header) : NaN;
  if (!Number.isFinite(serverMs)) return;
  const wallMs = Date.now();
  timeAnchor = { serverMs, wallMs, perfMs: performance.now() };
  // Persisting on every single response is wasteful; once a minute is plenty.
  if (wallMs - lastAnchorPersistedAt > 60_000) {
    lastAnchorPersistedAt = wallMs;
    AsyncStorage.setItem(TIME_ANCHOR_STORAGE_KEY, JSON.stringify({ serverMs, wallMs })).catch(() => {});
  }
}

/**
 * True only if this process has heard from the server and the wall clock has
 * advanced in step with the monotonic clock since then. Note the monotonic
 * clock doesn't advance while the phone is in deep sleep, so a long sleep
 * reads as "not verified" too — the safe direction: the server just treats
 * the capture time with more suspicion.
 */
export function isWallClockTrusted(): boolean {
  if (!timeAnchor) return false;
  const wallElapsed = Date.now() - timeAnchor.wallMs;
  const monoElapsed = performance.now() - timeAnchor.perfMs;
  return Math.abs(wallElapsed - monoElapsed) < MAX_CLOCK_DRIFT_MS;
}

/**
 * Used by the offline queue when the server rejects an upload because the
 * bearer token is missing/expired (kiosk/* isn't in SESSION_PROTECTED_PREFIXES,
 * so the interceptor below never refreshes for it). Same rules as the
 * interceptor: only a refresh the server itself rejected ends the session.
 */
export async function recoverSession(): Promise<"refreshed" | "expired" | "offline"> {
  try {
    const token = await refreshAccessTokenOnce();
    if (token) return "refreshed";
    authContext?.onSessionExpired();
    return "expired";
  } catch (error) {
    if (isNetworkError(error)) return "offline";
    throw error;
  }
}

apiClient.interceptors.response.use(
  (response) => {
    recordServerTime(response);
    return response;
  },
  async (error: AxiosError) => {
    const config = error.config as InternalAxiosRequestConfig | undefined;
    const status = error.response?.status;
    // An error response is still the server's clock.
    if (error.response) recordServerTime(error.response);
    const isSessionProtected = SESSION_PROTECTED_PREFIXES.some((prefix) => config?.url?.includes(prefix));

    if (status === 401 && isSessionProtected && config && !config._isRetry) {
      config._isRetry = true;
      try {
        const newAccessToken = await refreshAccessTokenOnce();
        if (newAccessToken) {
          config.headers.set("Authorization", `Bearer ${newAccessToken}`);
          return apiClient(config);
        }
        // refreshAccessTokenOnce() resolves null only when the refresh call
        // itself reached the server and the server rejected it (see
        // refreshSession in authStore.ts) — a definitive "this session is
        // dead," not a connectivity issue, so this is the only case that
        // should ever clear the user's tokens.
        authContext?.onSessionExpired();
      } catch (refreshErr) {
        // The refresh request never reached the server (offline, timeout,
        // DNS) — refreshSession() rethrows exactly this case rather than
        // resolving null, specifically so it's not mistaken for the server
        // confirming the session is dead. Leave the session alone; this
        // request just fails like any other network error, and the caller
        // (or the next foreground/reconnect) can retry it. Only re-raise a
        // non-network error, matching the same "unknown failure -> don't
        // silently swallow it" caution as any other unexpected exception.
        if (!isNetworkError(refreshErr)) throw refreshErr;
      }
    }

    return Promise.reject(error);
  },
);
