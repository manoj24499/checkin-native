import { useMutation, useQueryClient } from "@tanstack/react-query";
import { leaveService } from "@/api/services";

export function useCancelLeaveRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => leaveService.cancelLeaveRequest(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leave-requests"] }),
  });
}
