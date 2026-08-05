import type { AttendancePauseInterval, AttendanceRecord } from "@/types";

export interface DaySummary {
  dateKey: string;
  date: Date;
  checkIn: AttendanceRecord | null;
  checkOut: AttendanceRecord | null;
  durationMs: number | null;
}

function dateKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Mirrors the backend's lib/attendanceHours.ts computeWorkedMs — kept in
 * sync manually since this is a separate codebase from the Next.js backend. */
function computeWorkedMs(checkIn: Date, checkOut: Date, pauses: AttendancePauseInterval[]): number {
  const totalMs = checkOut.getTime() - checkIn.getTime();
  const pausedMs = pauses.reduce((sum, p) => {
    const end = p.resumedAt ? new Date(p.resumedAt) : checkOut;
    return sum + Math.max(0, end.getTime() - new Date(p.pausedAt).getTime());
  }, 0);
  return Math.max(0, totalMs - pausedMs);
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
    const durationMs =
      checkIn && checkOut
        ? computeWorkedMs(new Date(checkIn.timestamp), new Date(checkOut.timestamp), checkIn.pauses ?? [])
        : null;
    summaries.push({
      dateKey: key,
      date: new Date(checkIn?.timestamp ?? checkOut?.timestamp ?? Date.now()),
      checkIn,
      checkOut,
      durationMs,
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
