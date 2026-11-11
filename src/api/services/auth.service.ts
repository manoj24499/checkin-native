import { apiClient } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type {
  LoginRequest,
  LoginResponse,
  PinResetCompleteRequest,
  PinResetVerifyRequest,
  PinResetVerifyResponse,
  RefreshResponse,
  SetInitialPinRequest,
} from "@/types";

export const authService = {
  login(payload: LoginRequest) {
    return apiClient.post<LoginResponse>(endpoints.mobileLogin, payload).then((r) => r.data);
  },

  // First sign-in with an admin-generated PIN: swaps it for one the employee chooses. Not signed in.
  setInitialPin(payload: SetInitialPinRequest) {
    return apiClient
      .post<{ success: true }>(endpoints.setInitialPin, payload, { timeout: 60_000 })
      .then((r) => r.data);
  },

  // Forgot-PIN flow: the admin hands out a one-time code; verifying it returns a short-lived token that
  // lets the employee choose a new PIN. Neither call is signed in, and neither returns login tokens.
  verifyPinResetCode(payload: PinResetVerifyRequest) {
    return apiClient.post<PinResetVerifyResponse>(endpoints.pinResetVerify, payload).then((r) => r.data);
  },

  completePinReset(payload: PinResetCompleteRequest) {
    return apiClient.post<{ success: true }>(endpoints.pinResetComplete, payload).then((r) => r.data);
  },

  refresh(refreshToken: string) {
    return apiClient
      .post<RefreshResponse>(
        endpoints.mobileRefresh,
        { refreshToken },
        { _isRefreshCall: true },
      )
      .then((r) => r.data);
  },

  // Revokes this one specific refresh token server-side (see
  // app/api/mobile/logout/route.ts in the backend) — previously logout only
  // ever cleared local device storage, leaving a captured refresh token
  // valid server-side for its full 30-day life. Deliberately never throws:
  // authStore's logout() must still clear local state even if this network
  // call fails (offline, server error) — see its own comment.
  logout(refreshToken: string) {
    return apiClient.post(endpoints.mobileLogout, { refreshToken }).then(
      () => {},
      () => {},
    );
  },
};
