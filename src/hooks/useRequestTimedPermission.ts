import { useMutation, useQueryClient } from "@tanstack/react-query";
import { attendanceService } from "@/api/services";
import type { TimedPermissionRequest } from "@/types";

export function useRequestTimedPermission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TimedPermissionRequest) => attendanceService.requestTimedPermission(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["timed-permissions"] }),
  });
}
