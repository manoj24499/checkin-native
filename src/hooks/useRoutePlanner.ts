import { useCallback, useState } from "react";
import { assignedPlacesService } from "@/api/services";
import { distanceMeters, orderNearestFirstLocal, straightLine, type LatLng } from "@/utils/navigation";
import { getErrorMessage } from "@/utils/errors";
import type { AssignedPlace, PlannedPlace, RoutePlan } from "@/types";

/**
 * Plans the order of the worker's remaining places from where they are now (nearest first, then the
 * nearest to that one, by road when the server can). If the server cannot be reached the same plan
 * is made on the phone by straight-line distance, so the list and guidance keep working, just less
 * precisely.
 */
export function useRoutePlanner() {
  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const [planning, setPlanning] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const replan = useCallback(async (position: LatLng, candidates: AssignedPlace[]): Promise<RoutePlan> => {
    const pending = candidates.filter((p) => p.status === "PENDING");
    if (pending.length === 0) {
      const empty: RoutePlan = { roads: false, ordered: [], next: null };
      setPlan(empty);
      return empty;
    }
    setPlanning(true);
    setError(null);
    try {
      const result = await assignedPlacesService.plan(
        position,
        pending.map((p) => p.id),
      );
      setPlan(result);
      setOffline(false);
      return result;
    } catch (err) {
      const ordered = orderNearestFirstLocal(position, pending);
      let prev: LatLng = position;
      const planned: PlannedPlace[] = ordered.map((p) => {
        const d = distanceMeters(prev, p);
        prev = p;
        return { ...p, distanceMeters: Math.round(d), durationSeconds: Math.round(d / 7) };
      });
      const first = planned[0];
      const fallback: RoutePlan = {
        roads: false,
        ordered: planned,
        next: first ? { placeId: first.id, leg: straightLine(position, first, first.name) } : null,
      };
      setPlan(fallback);
      setOffline(true);
      setError(getErrorMessage(err));
      return fallback;
    } finally {
      setPlanning(false);
    }
  }, []);

  return { plan, planning, offline, error, replan };
}
