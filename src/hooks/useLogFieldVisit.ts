import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fieldService } from "@/api/services";
import type { FieldVisitRequest } from "@/types";

export function useLogFieldVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: FieldVisitRequest) => fieldService.logVisit(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["field-summary"] });
    },
  });
}
