import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { reimbursementService } from "@/api/services";
import { useAuth } from "./useAuth";

/** Field employees' travel reimbursement for `month` ("YYYY-MM", omit for
 * the current IST month) — Home's ReimbursementCard and the Reimbursement
 * screen. Only runs for FIELD-workMode employees; the server answers
 * `{ enabled: false }` for everyone else anyway. */
export function useReimbursements(month?: string) {
  const { user } = useAuth();
  const enabled = user?.workMode === "FIELD";
  return useQuery({
    queryKey: ["reimbursements", month ?? "current"],
    queryFn: () => reimbursementService.getSummary(month),
    enabled,
    // Today's estimate grows with each location ping (every ~2 min); past
    // days only change when an admin saves one, so a few minutes is plenty.
    staleTime: 120_000,
    refetchOnWindowFocus: true,
    // Stepping between months keeps the last month on screen (dimmed by the
    // Reimbursement screen) instead of flashing a full-screen loader.
    placeholderData: keepPreviousData,
  });
}
