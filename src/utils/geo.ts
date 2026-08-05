import * as Location from "expo-location";

const EARTH_RADIUS_METERS = 6_371_000;
const FIX_TIMEOUT_MS = 20_000;

/**
 * getCurrentPositionAsync has no built-in timeout — without this, a poor GPS
 * signal (indoors, underground parking, etc.) leaves the caller waiting
 * indefinitely with no feedback at all, which just looks like the app hung.
 */
export function getCurrentPositionWithTimeout(
  options: Location.LocationOptions,
): Promise<Location.LocationObject> {
  return Promise.race([
    Location.getCurrentPositionAsync(options),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), FIX_TIMEOUT_MS)),
  ]);
}

/**
 * Client-side mirror of the backend's geofence check (lib/geofence.ts in the
 * Next.js app), used only for immediate UI feedback (distance pill, disabling
 * the check-in button before a network round trip). The backend re-validates
 * on every check-in — this never grants access on its own.
 */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}
