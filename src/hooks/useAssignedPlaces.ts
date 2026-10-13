import { useQuery } from "@tanstack/react-query";
import { assignedPlacesService } from "@/api/services";

/** Today's places the admin assigned to this field worker. `enabled` should be true only for Field employees. */
export function useAssignedPlaces(enabled: boolean) {
  return useQuery({
    queryKey: ["assigned-places"],
    queryFn: () => assignedPlacesService.getToday(),
    enabled,
    staleTime: 30_000,
    // Picks up places an admin adds during the day.
    refetchInterval: enabled ? 120_000 : false,
  });
}
