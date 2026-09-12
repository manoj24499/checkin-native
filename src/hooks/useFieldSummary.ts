import { useQuery } from "@tanstack/react-query";
import { fieldService } from "@/api/services";

/** Distance/route/visits for today's Field check-in — powers the Map
 * screen's Field Day view. `enabled` should gate on the employee actually
 * being in a Field day (see LiveMapScreen) so this never fires pointlessly
 * for OFFICE/WFH employees. */
export function useFieldSummary(enabled: boolean) {
  return useQuery({
    queryKey: ["field-summary"],
    queryFn: () => fieldService.getSummary(),
    enabled,
    staleTime: 30_000,
    // Keep the route/distance fresh while `enabled` — pings land every 2
    // minutes (see services/locationTracking.ts), so polling faster than
    // that wouldn't show anything new. Gated on the external `enabled` flag,
    // not this query's own last `data.active` answer — see
    // useTimedPermissions' identical fix/comment for why that self-
    // referential form is a bug (one wrong/stale read stops polling for
    // good, no way to self-correct short of a remount).
    refetchInterval: enabled ? 60_000 : false,
  });
}
