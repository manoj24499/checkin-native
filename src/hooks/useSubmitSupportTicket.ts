import { useMutation } from "@tanstack/react-query";
import { supportService } from "@/api/services";
import type { SupportTicketInput } from "@/types";

/** No query to invalidate on success — unlike overtime/leave, this app
 * doesn't show the employee their own submitted tickets back (see the
 * backend's SupportTicket schema comment on why the flow stays one-way). */
export function useSubmitSupportTicket() {
  return useMutation({
    mutationFn: (payload: SupportTicketInput) => supportService.submit(payload),
  });
}
