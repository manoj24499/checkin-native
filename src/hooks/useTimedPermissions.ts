import { useQuery } from "@tanstack/react-query";
import { attendanceService } from "@/api/services";

/** Today's timed-permission requests for the caller's active check-in.
 * Polled (while `enabled`, driven by the caller's own active-session check)
 * so the dashboard's status card and the paused-reason copy stay current on
 * their own — gated on that external flag, not on this query's own last
 * answer: gating on `data.some(...)` here used to mean one wrong/stale read
 * (a network blip, anything transient) permanently stopped all further
 * polling with no way to self-correct short of a remount, the same class of
 * bug confirmed live in useAttendanceStatus.ts (see its own comment). */
export function useTimedPermissions(enabled: boolean) {
  return useQuery({
    queryKey: ["timed-permissions"],
    queryFn: () => attendanceService.getTimedPermissions(),
    enabled,
    staleTime: 15_000,
    refetchInterval: enabled ? 30_000 : false,
  });
}
