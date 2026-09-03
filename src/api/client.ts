import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
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

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as InternalAxiosRequestConfig | undefined;
    const status = error.response?.status;
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
