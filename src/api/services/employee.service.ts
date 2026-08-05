import { apiClient } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { AttendanceHistoryPage, ChangePinRequest, EmployeeProfile } from "@/types";

export const employeeService = {
  getProfile() {
    return apiClient.get<EmployeeProfile>(endpoints.me).then((r) => r.data);
  },

  getAttendanceHistory(params?: { take?: number; cursor?: string }) {
    return apiClient
      .get<AttendanceHistoryPage>(endpoints.meAttendance, { params })
      .then((r) => r.data);
  },

  changePin(payload: ChangePinRequest) {
    return apiClient.post<{ success: true }>(endpoints.changePin, payload).then((r) => r.data);
  },

  registerPushToken(token: string) {
    return apiClient.post<{ success: true }>(endpoints.pushToken, { token }).then((r) => r.data);
  },
};
