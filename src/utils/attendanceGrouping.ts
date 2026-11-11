import type { AttendancePauseInterval, AttendanceRecord, AttendanceSegment } from "@/types";

export interface DaySummary {
  dateKey: string;
  date: Date;
  checkIn: AttendanceRecord | null;
  checkOut: AttendanceRecord | null;
  /** Worked time — for a HYBRID day, travel (TRANSIT) is excluded. */
  durationMs: number | null;
  outsideMs: number | null;
  /** HYBRID days only (a timeline with HOME/TRANSIT): office / home / transit
   * split, up to check-out (or now for a still-open day). Null otherwise. */
  hybridSplit: SegmentSplit | null;
}

function dateKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Mirrors the backend's lib/attendanceHours.ts computeWorkedMs — kept in
 * sync manually since this is a separate codebase from the Next.js backend.
 * Exported so PresenceCard can reuse it for a *live* in-progress session too
 * — passing `now` in place of a real checkout works unchanged, since a still
 * -open pause is already treated as ending at whatever "checkout" moment is
 * passed in. */
export function computePausedMs(referenceEnd: Date, pauses: AttendancePauseInterval[]): number {
  return pauses.reduce((sum, p) => {
    const end = p.resumedAt ? new Date(p.resumedAt) : referenceEnd;
    return sum + Math.max(0, end.getTime() - new Date(p.pausedAt).getTime());
  }, 0);
}

/**
 * `segments` (optional): the session's segment timeline. Only matters for
 * HYBRID sessions — TRANSIT time is not work, so it's subtracted too (net of
 * any pause overlapping it, so nothing is subtracted twice). Mirrors the
 * backend's computeWorkedMs(…, segments); sessions with no TRANSIT segment get
 * exactly the same result as without it.
 */
export function computeWorkedMs(
  checkIn: Date,
  checkOut: Date,
  pauses: AttendancePauseInterval[],
  segments?: AttendanceSegment[],
): number {
  const totalMs = checkOut.getTime() - checkIn.getTime();
  const transitMs =
    segments && segments.some((s) => s.mode === "TRANSIT")
      ? computeSegmentSplit(checkIn, checkOut, segments, pauses).transitMs
      : 0;
  return Math.max(0, totalMs - computePausedMs(checkOut, pauses) - transitMs);
}

export interface SegmentSplit {
  officeMs: number;
  fieldMs: number;
  homeMs: number;
  transitMs: number;
}

/** Time per segment type, each net of any pause overlapping it — mirrors the
 * backend's lib/attendanceHours.ts computeSegmentSplit. A still-open segment
 * is treated as ending at `checkOut` (pass "now" for a live session). */
export function computeSegmentSplit(
  checkIn: Date,
  checkOut: Date,
  segments: AttendanceSegment[],
  pauses: AttendancePauseInterval[],
): SegmentSplit {
  const split: SegmentSplit = { officeMs: 0, fieldMs: 0, homeMs: 0, transitMs: 0 };
  const inMs = checkIn.getTime();
  const outMs = checkOut.getTime();
  for (const segment of segments) {
    const start = Math.max(inMs, new Date(segment.startedAt).getTime());
    const end = Math.min(outMs, segment.endedAt ? new Date(segment.endedAt).getTime() : outMs);
    if (end <= start) continue;
    let segmentMs = end - start;
    for (const p of pauses) {
      const pStart = new Date(p.pausedAt).getTime();
      const pEnd = p.resumedAt ? new Date(p.resumedAt).getTime() : outMs;
      const overlap = Math.min(pEnd, end) - Math.max(pStart, start);
      if (overlap > 0) segmentMs -= overlap;
    }
    segmentMs = Math.max(0, segmentMs);
    if (segment.mode === "OFFICE") split.officeMs += segmentMs;
    else if (segment.mode === "HOME") split.homeMs += segmentMs;
    else if (segment.mode === "TRANSIT") split.transitMs += segmentMs;
    else split.fieldMs += segmentMs;
  }
  return split;
}

/** True when a session's timeline is a HYBRID one (has a HOME or TRANSIT segment). */
export function isHybridTimeline(segments: AttendanceSegment[] | undefined): boolean {
  return !!segments && segments.some((s) => s.mode === "HOME" || s.mode === "TRANSIT");
}

/**
 * Groups a flat list of CHECK_IN/CHECK_OUT records (any order) into one
 * summary per calendar day, pairing each day's first check-in with its
 * check-out — mirrors the one-in/one-out-per-day rule the backend itself
 * enforces in /api/kiosk/scan, so this never has to guess which pairs go
 * together.
 */
export function groupAttendanceByDay(records: AttendanceRecord[]): DaySummary[] {
  const byDay = new Map<string, AttendanceRecord[]>();
  for (const r of records) {
    const key = dateKey(r.timestamp);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)?.push(r);
  }

  const summaries: DaySummary[] = [];
  for (const [key, dayRecords] of byDay) {
    const sorted = [...dayRecords].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
    const checkIn = sorted.find((r) => r.type === "CHECK_IN") ?? null;
    const checkOut = sorted.find((r) => r.type === "CHECK_OUT") ?? null;
    const segments = checkIn?.segments;
    const durationMs =
      checkIn && checkOut
        ? computeWorkedMs(new Date(checkIn.timestamp), new Date(checkOut.timestamp), checkIn.pauses ?? [], segments)
        : null;
    const hybridSplit =
      checkIn && segments && isHybridTimeline(segments)
        ? computeSegmentSplit(
            new Date(checkIn.timestamp),
            checkOut ? new Date(checkOut.timestamp) : new Date(),
            segments,
            checkIn.pauses ?? [],
          )
        : null;
    // For a still-open day (no checkout yet, e.g. today), use "now" as the
    // reference end so an open pause still counts toward outside time —
    // mirrors PresenceCard's live figure for the same in-progress session.
    const outsideMs = checkIn
      ? computePausedMs(checkOut ? new Date(checkOut.timestamp) : new Date(), checkIn.pauses ?? [])
      : null;
    summaries.push({
      dateKey: key,
      date: new Date(checkIn?.timestamp ?? checkOut?.timestamp ?? Date.now()),
      checkIn,
      checkOut,
      durationMs,
      outsideMs,
      hybridSplit,
    });
  }

  return summaries.sort((a, b) => b.date.getTime() - a.date.getTime());
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60_000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
