import { useQuery } from "@tanstack/react-query";
import { leaveService } from "@/api/services";

/** This year's public holidays — long staleTime since these change rarely. */
export function useHolidays() {
  return useQuery({
    queryKey: ["holidays"],
    queryFn: () => leaveService.getHolidays(),
    staleTime: 60 * 60_000,
  });
}
