import { apiClient } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type {
  KioskStatus,
  OvertimeRequest,
  OvertimeRequestInput,
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
    // Check-in/out does PIN hashing, face verification and photo upload server-side. Giving up at the default
    // 15 s while the server is still working is how a check-in gets recorded yet looks "failed" on the phone
    // (and is then queued as an offline duplicate), so wait much longer.
    // `X-Client-Action` records HOW this was done for the admin's audit log: the slide-to-confirm button, or an
    // earlier offline attempt being sent now.
    return apiClient
      .post<ScanResult>(endpoints.kioskScan, payload, {
        timeout: 60_000,
        headers: { "X-Client-Action": payload.offline ? "OFFLINE_SYNC" : "SLIDE_TO_CONFIRM" },
      })
      .then((r) => r.data);
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

  /** Today's overtime request for the caller's active check-in, if any. */
  getOvertimeRequests() {
    return apiClient.get<{ requests: OvertimeRequest[] }>(endpoints.overtime).then((r) => r.data.requests);
  },

  /** Self-declared, takes effect immediately — see the type's own comment. */
  requestOvertime(payload: OvertimeRequestInput) {
    return apiClient.post<OvertimeRequest>(endpoints.overtime, payload).then((r) => r.data);
  },
};
