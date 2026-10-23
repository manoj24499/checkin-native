// Formatting helpers shared by Home's ReimbursementCard and the
// Reimbursement screen. Amounts are whole rupees from the server, but a
// saved (approved) row may carry paise, so up to 2 decimals are kept.

/** "₹2,840" (en-IN grouping: ₹1,23,456). */
export function formatRupees(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/** "24.6 km" (one decimal at most). */
export function formatKm(km: number): string {
  return `${km.toLocaleString("en-IN", { maximumFractionDigits: 1 })} km`;
}

/** "₹8/km" — `compact` drops the spaces ("₹8 / km" otherwise). */
export function formatRate(rate: number, compact = false): string {
  return compact ? `${formatRupees(rate)}/km` : `${formatRupees(rate)} / km`;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const SHORT_MONTHS = MONTHS.map((m) => m.slice(0, 3));
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "2026-10" -> "October 2026". */
export function formatMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1] ?? ""} ${y}`;
}

/** "2026-10-21" -> "Tue, 21 Oct" (a date-only key, so no timezone shift). */
export function formatDayKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${weekday}, ${d} ${SHORT_MONTHS[m - 1]}`;
}

/** Shift a "YYYY-MM" key by `delta` months. */
export function shiftMonthKey(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}
