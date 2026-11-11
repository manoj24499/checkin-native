import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { workSegmentService } from "@/api/services";
import { onLocationPingSent } from "@/services/locationTracking";

/** Current segment (Field/Office, or Office/Home/Transit for HYBRID) —
 * polled while checked in, same cadence as the paused/timed-permission
 * indicators, so the dashboard reflects an auto-switch (see
 * /api/kiosk/location) without the employee needing to pull-to-refresh.
 * Also refetched after each accepted location ping (the server decides
 * arrivals from pings) and on app foreground (see reactQueryLiveSync). */
export function useWorkSegment(enabled: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    return onLocationPingSent(() => {
      void queryClient.invalidateQueries({ queryKey: ["work-segment"] });
    });
  }, [enabled, queryClient]);

  return useQuery({
    queryKey: ["work-segment"],
    queryFn: () => workSegmentService.getStatus(),
    enabled,
    staleTime: 15_000,
    refetchInterval: enabled ? 30_000 : false,
  });
}
