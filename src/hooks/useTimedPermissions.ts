import { useQuery } from "@tanstack/react-query";
import { attendanceService } from "@/api/services";

/** Today's timed-permission requests for the caller's active check-in.
 * Polled while any request is still scheduled/active so the dashboard's
 * status card and the paused-reason copy stay current on their own. */
export function useTimedPermissions(enabled: boolean) {
  return useQuery({
    queryKey: ["timed-permissions"],
    queryFn: () => attendanceService.getTimedPermissions(),
    enabled,
    staleTime: 15_000,
    refetchInterval: (query) =>
      query.state.data?.some((p) => p.status !== "resolved") ? 30_000 : false,
  });
}
