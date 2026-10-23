import { apiClient } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import { getTrackingToken } from "@/services/trackingTokens";
import type { LocationPingRequest, LocationPingResponse, OfficeLocation } from "@/types";

export const locationService = {
  getOfficeLocation() {
    return apiClient
      .get<{ officeLocation: OfficeLocation | null }>(endpoints.kioskOfficeLocation)
      .then((r) => r.data.officeLocation);
  },

  async sendPing(payload: LocationPingRequest) {
    // The session's tracking token is the primary proof for this endpoint (it outlives the
    // 15-minute access token); without one the server falls back to the bearer token.
    const trackingToken = await getTrackingToken(payload.attendanceId).catch(() => null);
    return apiClient
      .post<LocationPingResponse>(
        endpoints.kioskLocation,
        payload,
        trackingToken ? { headers: { "X-Tracking-Token": trackingToken } } : undefined,
      )
      .then((r) => r.data);
  },
};
