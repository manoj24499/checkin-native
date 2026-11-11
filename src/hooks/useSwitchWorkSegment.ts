import { useMutation, useQueryClient } from "@tanstack/react-query";
import { workSegmentService } from "@/api/services";
import type { WorkSegmentMode, WorkSegmentStatus, WorkSegmentSwitchRequest } from "@/types";

/**
 * Manual segment change. Accepts either a bare mode (FIELD's Office/Field
 * correction, unchanged) or a full request body (HYBRID: switch to TRANSIT
 * with a heading, "I've arrived" as `{ mode }`, or `{ extend: true }`).
 */
export function useSwitchWorkSegment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: WorkSegmentMode | WorkSegmentSwitchRequest) =>
      typeof input === "string" ? workSegmentService.switchMode(input) : workSegmentService.update(input),
    onSuccess: (segment: WorkSegmentStatus) => {
      // Show the new state at once; the refetch below confirms it.
      if (segment && "mode" in segment) queryClient.setQueryData(["work-segment"], segment);
    },
    // Also on failure: a 409 "Your status just changed" means a location ping
    // switched the segment at the same moment — refetch so the card shows it.
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["work-segment"] }),
        // Today's per-place minutes (status.hybrid.segmentMinutes) and hours.
        queryClient.invalidateQueries({ queryKey: ["attendance-status"] }),
        queryClient.invalidateQueries({ queryKey: ["attendance-history", "recent"] }),
      ]),
  });
}
