import { apiClient } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { LeaveBalance, PublicHoliday, TimeOffRequest, TimeOffRequestInput } from "@/types";

export const leaveService = {
  /** This year's leave requests and balances for the caller. */
  getRequests() {
    return apiClient
      .get<{ requests: TimeOffRequest[]; balances: LeaveBalance[] }>(endpoints.leaveRequests)
      .then((r) => r.data);
  },

  /** Self-declared — takes effect only once an admin approves it. */
  requestLeave(payload: TimeOffRequestInput) {
    return apiClient.post<TimeOffRequest>(endpoints.leaveRequests, payload).then((r) => r.data);
  },

  /** Withdraw a still-pending request — no effect on an already-decided one. */
  cancelLeaveRequest(id: string) {
    return apiClient
      .patch<{ id: string; status: string }>(endpoints.leaveRequest(id))
      .then((r) => r.data);
  },

  /** This year's public holidays — for context while picking dates. */
  getHolidays() {
    return apiClient.get<{ holidays: PublicHoliday[] }>(endpoints.holidays).then((r) => r.data.holidays);
  },
};
