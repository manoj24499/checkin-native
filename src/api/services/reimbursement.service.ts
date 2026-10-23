import { apiClient } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { ReimbursementSummary } from "@/types";

export const reimbursementService = {
  /** Travel reimbursement for one IST month ("YYYY-MM"); omit for the current month. */
  getSummary(month?: string) {
    return apiClient
      .get<ReimbursementSummary>(endpoints.reimbursements, { params: month ? { month } : undefined })
      .then((r) => r.data);
  },
};
