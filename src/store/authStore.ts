import { create } from "zustand";
import { setApiAuthContext } from "@/api/client";
import { authService, employeeService } from "@/api/services";
import { secureStorage } from "@/utils/secureStorage";
import { isNetworkError } from "@/utils/errors";
import { stopLocationTracking } from "@/services/locationTracking";
import { useAttendanceSessionStore } from "@/store/attendanceSessionStore";
import { useCheckInDraftStore } from "@/store/checkInDraftStore";
import type { EmployeeProfile } from "@/types";

export type AuthStatus = "bootstrapping" | "authenticated" | "unauthenticated";

interface AuthState {
  status: AuthStatus;
  accessToken: string | null;
  refreshToken: string | null;
  // Always the full profile shape — filled in with placeholder home-location
  // fields immediately after login, then overwritten by a real /me fetch.
  user: EmployeeProfile | null;

  bootstrap: () => Promise<void>;
  login: (employeeCode: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<string | null>;
  refreshProfile: () => Promise<void>;
  applyTokens: (accessToken: string, refreshToken: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "bootstrapping",
  accessToken: null,
  refreshToken: null,
  user: null,

  async bootstrap() {
    const tokens = await secureStorage.getTokens();
    if (!tokens) {
      set({ status: "unauthenticated" });
      return;
    }
    set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
    try {
      const profile = await employeeService.getProfile();
      set({ user: profile, status: "authenticated" });
    } catch (err) {
      // A definitive session expiry (server rejected the access token, then
      // rejected the refresh token too) already ran logout() itself via
      // onSessionExpired (see client.ts's response interceptor) before this
      // catch even runs — status is already "unauthenticated" in that case,
      // and calling logout() again below would just be a harmless repeat.
      if (get().status === "unauthenticated") return;
      if (isNetworkError(err)) {
        // Couldn't reach the server at all (offline, DNS, timeout) — that
        // says nothing about whether these tokens are still valid. Wiping
        // them here would force a real login every time the app happens to
        // launch without connectivity. Stay authenticated with the tokens
        // we already have; screens that need the profile will refetch once
        // the network comes back.
        set({ status: "authenticated" });
        return;
      }
      // Any other failure (a genuine 401 with no interceptor recovery, a
      // 5xx, ...) — treat conservatively, same as before this fix.
      await get().logout();
    }
  },

  async login(employeeCode, pin) {
    const result = await authService.login({ employeeCode, pin });
    await secureStorage.setTokens(result.accessToken, result.refreshToken);
    set({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: { ...result.user, homeLatitude: null, homeLongitude: null, homeRadiusMeters: 50 },
      status: "authenticated",
    });
    // Backfill the full profile (home-location fields) right after login.
    try {
      await get().refreshProfile();
    } catch {
      // Non-fatal — screens that need it will refetch.
    }
  },

  async logout() {
    // Clear anything scoped to *this* employee's session before another
    // employee can possibly log in on the same device — none of this is
    // per-device state, and leaving it behind leaks one employee's data
    // (a draft check-in photo, an active location-tracking session tied to
    // their attendance record) into the next person's session.
    await stopLocationTracking().catch(() => {});
    useAttendanceSessionStore.getState().stopTracking();
    useCheckInDraftStore.getState().setPhotoDataUrl(null);

    await secureStorage.clearTokens();
    set({ accessToken: null, refreshToken: null, user: null, status: "unauthenticated" });
  },

  async refreshSession() {
    const { refreshToken } = get();
    if (!refreshToken) return null;
    try {
      const result = await authService.refresh(refreshToken);
      await secureStorage.setTokens(result.accessToken, result.refreshToken);
      set({ accessToken: result.accessToken, refreshToken: result.refreshToken });
      return result.accessToken;
    } catch (err) {
      if (isNetworkError(err)) {
        // The refresh call itself never reached the server — this says
        // nothing about whether the refresh token is actually still valid,
        // so it must not be treated the same as the server rejecting it.
        // Rethrow (rather than resolving null) so the response interceptor
        // in client.ts can tell "network down" apart from "session
        // confirmed dead" and skip logging the user out over a
        // connectivity blip.
        throw err;
      }
      return null;
    }
  },

  async refreshProfile() {
    const profile = await employeeService.getProfile();
    set({ user: profile });
  },

  // Stores a token pair the server issued outside the normal login/refresh
  // flow — currently just change-pin, which invalidates every previously
  // issued token (including this device's own) the moment the PIN changes
  // server-side, and returns a fresh pair in the same response specifically
  // so the caller can stay signed in instead of being logged out by its own
  // PIN change.
  async applyTokens(accessToken, refreshToken) {
    await secureStorage.setTokens(accessToken, refreshToken);
    set({ accessToken, refreshToken });
  },
}));

setApiAuthContext({
  getAccessToken: () => useAuthStore.getState().accessToken,
  refreshAccessToken: () => useAuthStore.getState().refreshSession(),
  onSessionExpired: () => {
    void useAuthStore.getState().logout();
  },
});
