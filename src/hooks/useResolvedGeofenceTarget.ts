import { useMemo } from "react";
import { useAuth } from "./useAuth";
import { useOfficeLocation } from "./useOfficeLocation";
import type { GeofenceTarget } from "./useGeofence";
import type { CheckInMode } from "@/types";

/** Resolves which location (if any) the current employee should be
 * geofenced against — shared by the Dashboard and CheckInOutScreen so the
 * mode → target mapping only lives in one place.
 *
 * `fieldOverrideMode` only matters for FIELD-workMode employees: passing
 * "OFFICE" (their day's choice on the check-in screen) geofences them
 * against the shared office location like a regular OFFICE employee for
 * that day; anything else (including omitting it) keeps them ungeofenced. */
export function useResolvedGeofenceTarget(fieldOverrideMode?: CheckInMode | null): GeofenceTarget | null {
  const { user } = useAuth();
  const officeQuery = useOfficeLocation();

  return useMemo(() => {
    if (!user) return null;

    if (user.workMode === "FIELD") {
      if (fieldOverrideMode !== "OFFICE" || !officeQuery.data) return null;
      return {
        latitude: officeQuery.data.latitude,
        longitude: officeQuery.data.longitude,
        radiusMeters: officeQuery.data.radiusMeters,
      };
    }

    if (user.workMode === "WFH") {
      if (user.homeLatitude == null || user.homeLongitude == null) return null;
      return {
        latitude: user.homeLatitude,
        longitude: user.homeLongitude,
        radiusMeters: user.homeRadiusMeters,
      };
    }

    if (officeQuery.data) {
      return {
        latitude: officeQuery.data.latitude,
        longitude: officeQuery.data.longitude,
        radiusMeters: officeQuery.data.radiusMeters,
      };
    }
    return null;
  }, [user, officeQuery.data, fieldOverrideMode]);
}
