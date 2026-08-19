import { apiClient } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type {
  KioskStatus,
  ScanRequest,
  ScanResult,
  TimedPermission,
  TimedPermissionRequest,
} from "@/types";

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

  /** Today's timed-permission requests for the caller's active check-in. */
  getTimedPermissions() {
    return apiClient
      .get<{ permissions: TimedPermission[] }>(endpoints.timedPermission)
      .then((r) => r.data.permissions);
  },

  /** Self-declared pause window — takes effect immediately, no approval step. */
  requestTimedPermission(payload: TimedPermissionRequest) {
    return apiClient.post<TimedPermission>(endpoints.timedPermission, payload).then((r) => r.data);
  },
};
