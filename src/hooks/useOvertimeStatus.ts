import { useQuery } from "@tanstack/react-query";
import { attendanceService } from "@/api/services";

/** Today's overtime request for the caller's active check-in, if any.
 * Polled (while `enabled`, driven by the caller's own active-session check)
 * so the dashboard's status card stays current on its own — see
 * useTimedPermissions' identical fix/comment for why this is gated on that
 * external flag rather than this query's own last answer. */
export function useOvertimeStatus(enabled: boolean) {
  return useQuery({
    queryKey: ["overtime-requests"],
    queryFn: () => attendanceService.getOvertimeRequests(),
    enabled,
    staleTime: 15_000,
    refetchInterval: enabled ? 30_000 : false,
  });
}
