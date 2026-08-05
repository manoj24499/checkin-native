import { create } from "zustand";
import { setApiAuthContext } from "@/api/client";
import { authService, employeeService } from "@/api/services";
import { secureStorage } from "@/utils/secureStorage";
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
    } catch {
      // The client already retries once via refreshAccessToken() on a 401;
      // reaching here means the refresh token is gone too.
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
    } catch {
      return null;
    }
  },

  async refreshProfile() {
    const profile = await employeeService.getProfile();
    set({ user: profile });
  },
}));

setApiAuthContext({
  getAccessToken: () => useAuthStore.getState().accessToken,
  refreshAccessToken: () => useAuthStore.getState().refreshSession(),
  onSessionExpired: () => {
    void useAuthStore.getState().logout();
  },
});
