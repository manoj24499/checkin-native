import { apiClient } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type {
  AttendanceHistoryPage,
  ChangePinRequest,
  ChangePinResponse,
  EmployeeProfile,
  FaceEnrollResult,
} from "@/types";

export const employeeService = {
  getProfile() {
    return apiClient.get<EmployeeProfile>(endpoints.me).then((r) => r.data);
  },

  // `photo` is a `data:image/jpeg;base64,...` URL, same convention as
  // ScanRequest's check-in photo. Not idempotent-guarded server-side — safe
  // to call again on retry (e.g. after a "no face detected" rejection).
  enrollFace(photo: string) {
    return apiClient.post<FaceEnrollResult>(endpoints.faceEnroll, { photo }).then((r) => r.data);
  },

  getAttendanceHistory(params?: { take?: number; cursor?: string }) {
    return apiClient
      .get<AttendanceHistoryPage>(endpoints.meAttendance, { params })
      .then((r) => r.data);
  },

  // Returns a fresh access/refresh token pair — the server invalidates every
  // token issued before the PIN change (see the backend's tokenVersion
  // mechanism), including this device's own previous pair, so the caller
  // must store these immediately or the very next request will 401.
  changePin(payload: ChangePinRequest) {
    return apiClient.post<ChangePinResponse>(endpoints.changePin, payload).then((r) => r.data);
  },

  registerPushToken(token: string) {
    return apiClient.post<{ success: true }>(endpoints.pushToken, { token }).then((r) => r.data);
  },
};
