import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { env } from "@/config/env";

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
      const newAccessToken = await refreshAccessTokenOnce();
      if (newAccessToken) {
        config.headers.set("Authorization", `Bearer ${newAccessToken}`);
        return apiClient(config);
      }
      authContext?.onSessionExpired();
    }

    return Promise.reject(error);
  },
);
