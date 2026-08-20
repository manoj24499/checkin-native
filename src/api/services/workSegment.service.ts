import { apiClient } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { WorkSegmentMode, WorkSegmentStatus } from "@/types";

export const workSegmentService = {
  /** Current Field/Office segment for the caller's active check-in. */
  getStatus() {
    return apiClient.get<WorkSegmentStatus>(endpoints.workSegment).then((r) => r.data);
  },

  /** Manual correction — for when GPS auto-detection is late, wrong, or unavailable. */
  switchMode(mode: WorkSegmentMode) {
    return apiClient.post<WorkSegmentStatus>(endpoints.workSegment, { mode }).then((r) => r.data);
  },
};
