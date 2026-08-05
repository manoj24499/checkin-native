import { useQuery } from "@tanstack/react-query";
import { attendanceService } from "@/api/services";

export function useAttendanceStatus(employeeCode: string | undefined) {
  return useQuery({
    queryKey: ["attendance-status", employeeCode],
    queryFn: () => attendanceService.getStatus(employeeCode as string),
    enabled: !!employeeCode,
    staleTime: 15_000,
    // While an active session is open, poll so an auto-pause/resume (driven
    // entirely by background location pings, not anything this screen does)
    // shows up without the employee having to background/refocus the app.
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.exists && data.checkedIn && !data.checkedOut ? 30_000 : false;
    },
  });
}
