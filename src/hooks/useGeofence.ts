import { useCallback, useEffect, useState } from "react";
import * as Location from "expo-location";
import { haversineDistanceMeters, getCurrentPositionWithTimeout } from "@/utils/geo";

export interface GeofenceTarget {
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

interface GeofenceState {
  isLoading: boolean;
  error: string | null;
  coords: { latitude: number; longitude: number } | null;
  distanceMeters: number | null;
  withinRadius: boolean | null;
  /** True when the OS flagged this reading as coming from a mock location
   * provider (Android only — `undefined`/`false` elsewhere). */
  mocked: boolean;
}

/**
 * Client-side geofence pre-check so the UI can guide the employee before
 * they attempt a check-in. This is advisory only — /api/kiosk/scan re-checks
 * the distance (and the mocked flag) server-side and is the sole source of
 * truth.
 */
export function useGeofence(target: GeofenceTarget | null | undefined) {
  const [state, setState] = useState<GeofenceState>({
    isLoading: false,
    error: null,
    coords: null,
    distanceMeters: null,
    withinRadius: null,
    mocked: false,
  });

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setState({
          isLoading: false,
          error: "Location permission is required to check in.",
          coords: null,
          distanceMeters: null,
          withinRadius: null,
          mocked: false,
        });
        return;
      }

      const position = await getCurrentPositionWithTimeout({
        accuracy: Location.Accuracy.High,
      });
      const coords = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      if (position.mocked) {
        setState({
          isLoading: false,
          error: "Mock location detected. Disable mock/fake GPS apps to check in.",
          coords,
          distanceMeters: null,
          withinRadius: null,
          mocked: true,
        });
        return;
      }

      if (!target) {
        setState({
          isLoading: false,
          error: null,
          coords,
          distanceMeters: null,
          withinRadius: null,
          mocked: false,
        });
        return;
      }

      const distanceMeters = haversineDistanceMeters(
        coords.latitude,
        coords.longitude,
        target.latitude,
        target.longitude,
      );
      setState({
        isLoading: false,
        error: null,
        coords,
        distanceMeters,
        withinRadius: distanceMeters <= target.radiusMeters,
        mocked: false,
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error:
          error instanceof Error && error.message === "timeout"
            ? "Getting your location is taking too long. Move somewhere with a clearer view of the sky and try again."
            : "Couldn't determine your location.",
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.latitude, target?.longitude, target?.radiusMeters]);

  useEffect(() => {
    // No target (FIELD workers, or WFH/OFFICE with nothing configured yet)
    // means nothing to check distance against — skip requesting location
    // permission at all rather than asking for something that won't be used.
    if (!target) return;
    refresh();
  }, [refresh, target]);

  return { ...state, refresh };
}
