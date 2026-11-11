import { apiClient } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { WorkSegmentMode, WorkSegmentStatus, WorkSegmentSwitchRequest } from "@/types";

export const workSegmentService = {
  /** Current segment (Field/Office, or Office/Home/Transit for HYBRID) for the caller's active check-in. */
  getStatus() {
    return apiClient.get<WorkSegmentStatus>(endpoints.workSegment).then((r) => r.data);
  },

  /** FIELD: manual Office/Field correction — for when GPS auto-detection is late, wrong, or unavailable. */
  switchMode(mode: WorkSegmentMode) {
    return postSegment({ mode } as WorkSegmentSwitchRequest);
  },

  /** Any body the endpoint accepts — HYBRID switch to TRANSIT (with heading), arrive, or extend. */
  update(body: WorkSegmentSwitchRequest) {
    return postSegment(body);
  },
};

function postSegment(body: WorkSegmentSwitchRequest) {
  return apiClient.post<WorkSegmentStatus>(endpoints.workSegment, body).then((r) => r.data);
}
