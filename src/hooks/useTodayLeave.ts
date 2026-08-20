import { useLeaveRequests } from "./useLeaveRequests";
import type { TimeOffRequest } from "@/types";

/** The approved leave request covering today, if any — derived client-side
 * from the same data useLeaveRequests already fetches, no separate endpoint
 * needed. Mirrors the backend's own check in /api/kiosk/scan (local-midnight
 * instant comparison), so this always agrees with whether check-in is
 * actually blocked. */
export function useTodayLeave(): TimeOffRequest | null {
  const query = useLeaveRequests();
  const requests = query.data?.requests ?? [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTime = today.getTime();

  return (
    requests.find(
      (r) =>
        r.status === "APPROVED" &&
        new Date(r.startDate).getTime() <= todayTime &&
        todayTime <= new Date(r.endDate).getTime(),
    ) ?? null
  );
}
