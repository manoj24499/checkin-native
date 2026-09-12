import { useQuery } from "@tanstack/react-query";
import { attendanceService } from "@/api/services";

export function useAttendanceStatus(employeeCode: string | undefined) {
  return useQuery({
    queryKey: ["attendance-status", employeeCode],
    queryFn: () => attendanceService.getStatus(employeeCode as string),
    enabled: !!employeeCode,
    staleTime: 15_000,
    // Poll so an auto-pause/resume (driven entirely by background location
    // pings, not anything this screen does) shows up without the employee
    // having to background/refocus the app — and so a genuinely checked-in
    // employee never gets stuck showing "not checked in" if a single poll
    // ever comes back wrong (a network blip, anything transient). This used
    // to gate polling on `data.checkedIn` from the *previous* poll — a
    // self-healing dead end: one wrong/stale read flipped that to false
    // forever, silently killing all future polling until the app was fully
    // restarted (confirmed live: 2026-09-11, EMP001's Dashboard stuck
    // showing "not checked in" for ~26 minutes while actually checked in,
    // backend confirmed correct throughout). Only stop once actually
    // checked out — the one state where nothing more changes until
    // tomorrow — never because of what the last poll happened to say.
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.exists && data.checkedOut ? false : 30_000;
    },
  });
}
