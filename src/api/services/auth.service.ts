import { apiClient } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { LoginRequest, LoginResponse, RefreshResponse } from "@/types";

export const authService = {
  login(payload: LoginRequest) {
    return apiClient.post<LoginResponse>(endpoints.mobileLogin, payload).then((r) => r.data);
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
};
