import { apiClient } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { KioskStatus, ScanRequest, ScanResult } from "@/types";

export const attendanceService = {
  /** Pre-check used to drive the dashboard/check-in UI — no PIN required. */
  getStatus(employeeCode: string) {
    return apiClient
      .get<KioskStatus>(endpoints.kioskStatus, { params: { employeeCode } })
      .then((r) => r.data);
  },

  /** The one true check-in/check-out call — same endpoint the kiosk uses. */
  scan(payload: ScanRequest) {
    return apiClient.post<ScanResult>(endpoints.kioskScan, payload).then((r) => r.data);
  },
};
