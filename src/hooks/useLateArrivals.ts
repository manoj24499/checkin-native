import { useQuery } from "@tanstack/react-query";
import { lateArrivalService } from "@/api/services";

/** The employee's own late check-ins, for the Requests > Permission tab (read-only).
 * Refetched whenever the tab is focused, so a check-in just made shows up. */
export function useLateArrivals(enabled = true) {
  return useQuery({
    queryKey: ["late-arrivals"],
    queryFn: () => lateArrivalService.getAll(),
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
