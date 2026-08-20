import { useMemo } from "react";
import { useAuth } from "./useAuth";
import { useOfficeLocation } from "./useOfficeLocation";
import type { GeofenceTarget } from "./useGeofence";
import type { CheckInMode } from "@/types";

/** Resolves which location (if any) the current employee should be
 * geofenced against — shared by the Dashboard and CheckInOutScreen so the
 * mode → target mapping only lives in one place.
 *
 * `dayOverrideMode` is each profile's day-of choice from the check-in
 * screen's picker, and only matters for FIELD and WFH employees: passing
 * "OFFICE" geofences either of them against the shared office location like
 * a regular OFFICE employee for that day (covers a WFH employee physically
 * coming in — they'd otherwise stay geofenced against home and get
 * rejected there); anything else (including omitting it) keeps FIELD
 * ungeofenced and WFH geofenced against home, same as before this existed. */
export function useResolvedGeofenceTarget(dayOverrideMode?: CheckInMode | null): GeofenceTarget | null {
  const { user } = useAuth();
  const officeQuery = useOfficeLocation();

  return useMemo(() => {
    if (!user) return null;

    if (user.workMode === "FIELD") {
      if (dayOverrideMode !== "OFFICE" || !officeQuery.data) return null;
      return {
        latitude: officeQuery.data.latitude,
        longitude: officeQuery.data.longitude,
        radiusMeters: officeQuery.data.radiusMeters,
      };
    }

    if (user.workMode === "WFH") {
      if (dayOverrideMode === "OFFICE") {
        if (!officeQuery.data) return null;
        return {
          latitude: officeQuery.data.latitude,
          longitude: officeQuery.data.longitude,
          radiusMeters: officeQuery.data.radiusMeters,
        };
      }
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
  }, [user, officeQuery.data, dayOverrideMode]);
}
