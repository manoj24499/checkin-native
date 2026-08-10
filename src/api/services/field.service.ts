import { apiClient } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { FieldSummary, FieldVisit, FieldVisitRequest } from "@/types";

export const fieldService = {
  /** Distance covered + route + logged visits for today's Field check-in. */
  getSummary() {
    return apiClient.get<FieldSummary>(endpoints.fieldSummary).then((r) => r.data);
  },

  logVisit(payload: FieldVisitRequest) {
    return apiClient.post<FieldVisit>(endpoints.fieldVisits, payload).then((r) => r.data);
  },
};
