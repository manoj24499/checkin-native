import { useQuery } from "@tanstack/react-query";
import { attendanceService } from "@/api/services";

/** Today's overtime request for the caller's active check-in, if any.
 * Polled while it's still active (not yet closed out at a checkout) so the
 * dashboard's status card stays current on its own. */
export function useOvertimeStatus(enabled: boolean) {
  return useQuery({
    queryKey: ["overtime-requests"],
    queryFn: () => attendanceService.getOvertimeRequests(),
    enabled,
    staleTime: 15_000,
    refetchInterval: (query) => (query.state.data?.some((r) => r.active) ? 30_000 : false),
  });
}
