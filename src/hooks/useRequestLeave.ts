import { useMutation, useQueryClient } from "@tanstack/react-query";
import { leaveService } from "@/api/services";
import type { TimeOffRequestInput } from "@/types";

export function useRequestLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TimeOffRequestInput) => leaveService.requestLeave(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["leave-requests"] }),
  });
}
