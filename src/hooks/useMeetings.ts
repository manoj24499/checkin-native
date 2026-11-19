import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { attendanceService } from "@/api/services";
import type { MeetingInput } from "@/types";

const KEY = ["meetings"];

/** The caller's meetings outside shift hours (last 7 days and everything ahead). */
export function useMeetings(enabled = true) {
  return useQuery({
    queryKey: KEY,
    queryFn: () => attendanceService.getMeetings(),
    enabled,
    staleTime: 15_000,
  });
}

export function useAddMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: MeetingInput) => attendanceService.addMeeting(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useCancelMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => attendanceService.cancelMeeting(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
