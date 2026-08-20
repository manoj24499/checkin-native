import { useQuery } from "@tanstack/react-query";
import { workSegmentService } from "@/api/services";

/** Current Field/Office segment — polled while checked in, same cadence as
 * the paused/timed-permission indicators, so the dashboard reflects an
 * auto-switch (see /api/kiosk/location's evaluateWorkSegment) without the
 * employee needing to pull-to-refresh. */
export function useWorkSegment(enabled: boolean) {
  return useQuery({
    queryKey: ["work-segment"],
    queryFn: () => workSegmentService.getStatus(),
    enabled,
    staleTime: 15_000,
    refetchInterval: enabled ? 30_000 : false,
  });
}
