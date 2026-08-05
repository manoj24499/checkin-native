import { useQuery } from "@tanstack/react-query";
import { locationService } from "@/api/services";

export function useOfficeLocation() {
  return useQuery({
    queryKey: ["office-location"],
    queryFn: () => locationService.getOfficeLocation(),
    staleTime: 5 * 60_000,
  });
}
