import { apiClient } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { LocationPingRequest, LocationPingResponse, OfficeLocation } from "@/types";

export const locationService = {
  getOfficeLocation() {
    return apiClient
      .get<{ officeLocation: OfficeLocation | null }>(endpoints.kioskOfficeLocation)
      .then((r) => r.data.officeLocation);
  },

  sendPing(payload: LocationPingRequest) {
    return apiClient
      .post<LocationPingResponse>(endpoints.kioskLocation, payload)
      .then((r) => r.data);
  },
};
