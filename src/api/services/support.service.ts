import { apiClient } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { SupportTicketInput, SupportTicketResult } from "@/types";

export const supportService = {
  /** "Report an issue" from Profile > Help — see the backend's SupportTicket
   * schema comment for why this is deliberately simple (no reply thread, no
   * push notification either direction). */
  submit(payload: SupportTicketInput) {
    return apiClient.post<SupportTicketResult>(endpoints.support, payload).then((r) => r.data);
  },
};
