import { apiClient } from "@/api/client";
import { endpoints } from "@/api/endpoints";
import type { AssignedPlace, RouteLeg, RoutePlan } from "@/types";

export const assignedPlacesService = {
  /** The places an admin assigned for today, in the order they were saved. */
  getToday() {
    return apiClient
      .get<{ date: string; places: AssignedPlace[] }>(endpoints.assignedPlaces)
      .then((r) => r.data.places);
  },

  /** Re-plans the remaining places from where the worker is now: nearest first, plus the route to the first. */
  plan(position: { latitude: number; longitude: number }, placeIds?: string[]) {
    return apiClient.post<RoutePlan>(endpoints.routePlan, { ...position, placeIds }).then((r) => r.data);
  },

  /** Road route with turn instructions from the worker to one place (used to re-route). */
  leg(position: { latitude: number; longitude: number }, placeId: string) {
    return apiClient
      .post<{ placeId: string; leg: RouteLeg }>(endpoints.routeLeg, { ...position, placeId })
      .then((r) => r.data.leg);
  },

  skip(placeId: string, reason: string) {
    return apiClient.post(endpoints.skipAssignedPlace(placeId), { reason }).then((r) => r.data);
  },
};
