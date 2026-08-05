import { useMemo } from "react";
import { useAuth } from "./useAuth";
import { useOfficeLocation } from "./useOfficeLocation";
import type { GeofenceTarget } from "./useGeofence";

/** Resolves which location (if any) the current employee should be
 * geofenced against — shared by the Dashboard and CheckInOutScreen so the
 * mode → target mapping only lives in one place. */
export function useResolvedGeofenceTarget(): GeofenceTarget | null {
  const { user } = useAuth();
  const officeQuery = useOfficeLocation();

  return useMemo(() => {
    if (!user || user.workMode === "FIELD") return null;
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
  }, [user, officeQuery.data]);
}
