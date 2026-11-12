import { AxiosError } from "axios";
import { apiClient } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { getTrackingToken, saveTrackingToken } from "@/services/trackingTokens";
import type { LocationPingRequest, LocationPingResponse, OfficeLocation } from "@/types";

export const locationService = {
  getOfficeLocation() {
    return apiClient
      .get<{ officeLocation: OfficeLocation | null }>(endpoints.kioskOfficeLocation)
      .then((r) => r.data.officeLocation);
  },

  /**
   * Asks the server for a fresh tracking token for the caller's own open session and saves it. For the case where
   * the check-in reply (the only time the token is handed out) never reached the phone. Returns the token, or null.
   */
  async recoverTrackingToken(attendanceId: string): Promise<string | null> {
    if (!attendanceId || attendanceId.startsWith("local-")) return null;
    try {
      const { data } = await apiClient.post<{ attendanceId: string; trackingToken: string }>(
        endpoints.trackingToken,
        { attendanceId },
      );
      if (!data?.trackingToken) return null;
      await saveTrackingToken(attendanceId, data.trackingToken);
      return data.trackingToken;
    } catch {
      return null;
    }
  },

  async sendPing(payload: LocationPingRequest) {
    // The session's tracking token is the primary proof for this endpoint (it outlives the
    // 15-minute access token); without one the server falls back to the bearer token.
    const trackingToken = await getTrackingToken(payload.attendanceId).catch(() => null);
    const post = (token: string | null) =>
      apiClient
        .post<LocationPingResponse>(
          endpoints.kioskLocation,
          payload,
          token ? { headers: { "X-Tracking-Token": token } } : undefined,
        )
        .then((r) => r.data);
    try {
      return await post(trackingToken);
    } catch (error) {
      // No token for this session (its check-in reply was lost) and the sign-in alone was refused:
      // fetch a fresh token once and retry. Only ever tried once per ping, and at most once a minute overall.
      const refused = error instanceof AxiosError && error.response?.status === 403;
      if (refused && !trackingToken && Date.now() - lastRecoveryAt > 60_000) {
        lastRecoveryAt = Date.now();
        const recovered = await locationService.recoverTrackingToken(payload.attendanceId);
        if (recovered) return post(recovered);
      }
      throw error;
    }
  },
};

let lastRecoveryAt = 0;
