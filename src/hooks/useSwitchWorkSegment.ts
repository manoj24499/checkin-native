import { useMutation, useQueryClient } from "@tanstack/react-query";
import { workSegmentService } from "@/api/services";
import type { WorkSegmentMode } from "@/types";

export function useSwitchWorkSegment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mode: WorkSegmentMode) => workSegmentService.switchMode(mode),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["work-segment"] }),
  });
}
