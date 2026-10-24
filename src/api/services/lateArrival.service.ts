import { apiClient } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { LateArrival } from "@/types";

export const lateArrivalService = {
  /** The employee's own late check-ins, newest first (read-only). */
  getAll() {
    return apiClient.get<{ arrivals: LateArrival[] }>(endpoints.lateArrivals).then((r) => r.data.arrivals);
  },
};
