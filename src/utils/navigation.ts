import type { RouteLeg, RouteStep } from "@/types";

// Pure helpers for the in-app turn-by-turn screen: where the worker is along the route, which
// instruction is current, how far the next turn is, whether they have left the route, and what to
// say. No React or native modules in here so it can be tested on its own.

export type LatLng = { latitude: number; longitude: number };
type Pt = [number, number]; // [latitude, longitude]

const EARTH_RADIUS_M = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;

export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

const between = (a: Pt, b: Pt) => distanceMeters({ latitude: a[0], longitude: a[1] }, { latitude: b[0], longitude: b[1] });

/** Distance in metres from `p` to the segment a-b, and how far along the segment (0..1) the closest point is. */
function toSegment(p: LatLng, a: Pt, b: Pt): { distance: number; t: number } {
  // Local flat approximation around p: accurate to well under a metre at these distances.
  const kx = Math.cos(rad(p.latitude)) * EARTH_RADIUS_M * (Math.PI / 180);
  const ky = EARTH_RADIUS_M * (Math.PI / 180);
  const ax = (a[1] - p.longitude) * kx;
  const ay = (a[0] - p.latitude) * ky;
  const bx = (b[1] - p.longitude) * kx;
  const by = (b[0] - p.latitude) * ky;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return { distance: Math.sqrt(cx * cx + cy * cy), t };
}

export interface RouteProgress {
  /** Index of the geometry point just behind the worker. */
  index: number;
  /** How far the worker is from the route line, in metres. */
  offRouteMeters: number;
}

/**
 * Where along `geometry` the worker is. Searches forward from `fromIndex` (a short window, so a
 * road that doubles back near itself cannot jump the position backwards) and picks the closest
 * segment.
 */
export function progressAlongRoute(position: LatLng, geometry: Pt[], fromIndex = 0, window = 80): RouteProgress {
  if (geometry.length < 2) return { index: 0, offRouteMeters: 0 };
  const start = Math.max(0, Math.min(fromIndex, geometry.length - 2));
  const end = Math.min(geometry.length - 2, start + window);
  let best = { index: start, distance: Infinity };
  for (let i = start; i <= end; i++) {
    const { distance } = toSegment(position, geometry[i], geometry[i + 1]);
    if (distance < best.distance) best = { index: i, distance };
  }
  return { index: best.index, offRouteMeters: best.distance };
}

/** Metres from the worker to geometry point `toIndex`, following the route from segment `index`. */
export function metersAlongRoute(position: LatLng, geometry: Pt[], index: number, toIndex: number): number {
  if (geometry.length === 0) return 0;
  const next = Math.min(index + 1, geometry.length - 1);
  if (toIndex <= index) return distanceMeters(position, { latitude: geometry[next][0], longitude: geometry[next][1] });
  let total = distanceMeters(position, { latitude: geometry[next][0], longitude: geometry[next][1] });
  for (let i = next; i < Math.min(toIndex, geometry.length - 1); i++) total += between(geometry[i], geometry[i + 1]);
  return total;
}

/** Which instruction applies at geometry point `index`: the last step that has already started. */
export function stepIndexAt(steps: RouteStep[], index: number): number {
  let current = 0;
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].from <= index) current = i;
    else break;
  }
  return current;
}

export interface Guidance {
  stepIndex: number;
  /** The instruction to show now (the upcoming maneuver). */
  upcoming: RouteStep | null;
  /** Metres until that maneuver. */
  metersToManeuver: number;
  metersRemaining: number;
  secondsRemaining: number;
  offRouteMeters: number;
  progressIndex: number;
}

/** Everything the screen needs for the current position on `leg`. */
export function guidanceFor(position: LatLng, leg: RouteLeg, fromIndex = 0): Guidance {
  const progress = progressAlongRoute(position, leg.geometry, fromIndex);
  const current = stepIndexAt(leg.steps, progress.index);
  // The maneuver to announce is the one that ends the current step (the start of the next).
  const upcoming = leg.steps[Math.min(current + 1, leg.steps.length - 1)] ?? null;
  const maneuverIndex = leg.steps[current]?.to ?? leg.geometry.length - 1;
  const metersToManeuver = metersAlongRoute(position, leg.geometry, progress.index, maneuverIndex);
  const metersRemaining = metersAlongRoute(position, leg.geometry, progress.index, leg.geometry.length - 1);
  const fraction = leg.distanceMeters > 0 ? Math.min(1, metersRemaining / leg.distanceMeters) : 0;
  return {
    stepIndex: current,
    upcoming,
    metersToManeuver,
    metersRemaining,
    secondsRemaining: Math.round(leg.durationSeconds * fraction),
    offRouteMeters: progress.offRouteMeters,
    progressIndex: progress.index,
  };
}

/** Left the route: this far away (metres) for several fixes in a row means re-route. */
export const OFF_ROUTE_METERS = 45;
export const OFF_ROUTE_FIXES = 3;
/** Close enough to count as arrived. */
export const ARRIVAL_METERS = 40;

export function hasArrived(position: LatLng, place: LatLng, accuracyMeters = 0): boolean {
  return distanceMeters(position, place) <= Math.max(ARRIVAL_METERS, Math.min(accuracyMeters, 80));
}

/** A glyph for the maneuver, drawn big on the instruction banner. */
export function maneuverGlyph(type: number): string {
  switch (type) {
    case 0:
      return "←"; // left
    case 1:
      return "→"; // right
    case 2:
      return "↙"; // sharp left
    case 3:
      return "↘"; // sharp right
    case 4:
    case 12:
      return "↖"; // slight left, keep left
    case 5:
    case 13:
      return "↗"; // slight right, keep right
    case 7:
    case 8:
      return "↻"; // roundabout
    case 9:
      return "↶"; // u-turn
    case 10:
      return "⚑"; // arrive
    default:
      return "↑"; // straight, depart
  }
}

export function formatMeters(m: number): string {
  if (m < 1000) return `${Math.max(0, Math.round(m / 10) * 10)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function formatDuration(seconds: number): string {
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, "0")} min`;
}

/** "in 300 metres" / "in 1.2 kilometres" for the voice prompt. */
export function spokenDistance(m: number): string {
  if (m >= 950) return `in ${(m / 1000).toFixed(1)} kilometres`;
  const rounded = m >= 100 ? Math.round(m / 50) * 50 : Math.round(m / 10) * 10;
  return `in ${rounded} metres`;
}

/** What to say for a step, with how far away it is (omitted when the turn is right here). */
export function spokenInstruction(step: RouteStep, metersAway: number): string {
  const text = step.instruction || "Continue";
  return metersAway > 60 ? `${spokenDistance(metersAway)}, ${text}` : text;
}

/** Nearest-first order by straight-line distance: the offline fallback when the server cannot plan. */
export function orderNearestFirstLocal<T extends LatLng>(from: LatLng, places: T[]): T[] {
  const left = [...places];
  const ordered: T[] = [];
  let at = from;
  while (left.length > 0) {
    let best = 0;
    for (let i = 1; i < left.length; i++) if (distanceMeters(at, left[i]) < distanceMeters(at, left[best])) best = i;
    const [next] = left.splice(best, 1);
    ordered.push(next);
    at = next;
  }
  return ordered;
}

/** A straight-line leg, used when there is no network to ask for a road route. */
export function straightLine(from: LatLng, to: LatLng, name: string): RouteLeg {
  const meters = distanceMeters(from, to);
  return {
    distanceMeters: Math.round(meters),
    durationSeconds: Math.round(meters / 7),
    geometry: [
      [from.latitude, from.longitude],
      [to.latitude, to.longitude],
    ],
    steps: [
      { instruction: `Head towards ${name}`, type: 11, name: "", distanceMeters: Math.round(meters), durationSeconds: Math.round(meters / 7), from: 0, to: 1 },
      { instruction: "You have arrived", type: 10, name: "", distanceMeters: 0, durationSeconds: 0, from: 1, to: 1 },
    ],
    provider: "straight-line",
  };
}
