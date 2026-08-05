import { useInfiniteQuery } from "@tanstack/react-query";
import { employeeService } from "@/api/services";

export function useAttendanceHistory() {
  return useInfiniteQuery({
    queryKey: ["attendance-history"],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      employeeService.getAttendanceHistory({ take: 30, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
