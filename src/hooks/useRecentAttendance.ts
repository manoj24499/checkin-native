import { useQuery } from "@tanstack/react-query";
import { employeeService } from "@/api/services";

/** Small, non-paginated fetch for dashboard summaries (e.g. "this week's
 * hours") — separate from the full infinite history list, but sharing the
 * same "attendance-history" query-key prefix so check-in/out invalidation
 * refreshes both. */
export function useRecentAttendance(take = 14) {
  return useQuery({
    queryKey: ["attendance-history", "recent", take],
    queryFn: () => employeeService.getAttendanceHistory({ take }),
    staleTime: 60_000,
  });
}
