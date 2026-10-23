/** GET /api/mobile/me/reimbursements — Field employees' travel reimbursement
 * for one IST month (distance x rate per km). APPROVED days were saved by an
 * admin (final); IN_REVIEW days have tracked distance the admin hasn't
 * confirmed yet, so their `amount` is only an estimate. */
export type ReimbursementDayStatus = "APPROVED" | "IN_REVIEW";

export interface ReimbursementDay {
  /** IST date key, "2026-10-21". */
  date: string;
  distanceKm: number;
  ratePerKm: number | null;
  /** Rupees; null when no rate was set. */
  amount: number | null;
  status: ReimbursementDayStatus;
  estimated: boolean;
  note: string | null;
}

export interface ReimbursementSummaryEnabled {
  enabled: true;
  /** Organization default rate in rupees per km; null = not set yet. */
  ratePerKm: number | null;
  /** "2026-10". */
  month: string;
  /** "2026-10-22". */
  todayKey: string;
  today: { active: boolean; distanceKm: number; estimatedAmount: number | null };
  totals: { distanceKm: number; approvedAmount: number; inReviewAmount: number; totalAmount: number };
  /** Newest first; excludes today (see `today`). */
  days: ReimbursementDay[];
}

/** Non-FIELD employees get `{ enabled: false }` and no other fields. */
export type ReimbursementSummary = ReimbursementSummaryEnabled | { enabled: false };
