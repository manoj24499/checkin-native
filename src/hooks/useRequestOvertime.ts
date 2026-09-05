import { useMutation, useQueryClient } from "@tanstack/react-query";
import { attendanceService } from "@/api/services";
import type { OvertimeRequestInput } from "@/types";

export function useRequestOvertime() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: OvertimeRequestInput) => attendanceService.requestOvertime(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["overtime-requests"] }),
  });
}
