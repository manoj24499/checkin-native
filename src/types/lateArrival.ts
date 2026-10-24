/** A check-in the server marked as late: "PERMISSION" (within the threshold) or "HALF_DAY" (beyond it). */
export interface LateArrival {
  id: string;
  /** ISO time of the check-in. */
  timestamp: string;
  lateMinutes: number | null;
  leaveType: "PERMISSION" | "HALF_DAY";
}
