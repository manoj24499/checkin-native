import { useQuery } from "@tanstack/react-query";
import { leaveService } from "@/api/services";

/** This year's leave requests and balances — not scoped to an active
 * check-in (unlike Timed Permission), so this is always enabled. */
export function useLeaveRequests() {
  return useQuery({
    queryKey: ["leave-requests"],
    queryFn: () => leaveService.getRequests(),
    staleTime: 30_000,
  });
}
