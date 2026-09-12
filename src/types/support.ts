/** POST /api/mobile/support input — the "report an issue" form on
 * Profile > Help. `photo` is a data URL, same convention as every other
 * photo upload in this app (check-in presence photo, overtime work-summary
 * photo). Deliberately just message + optional photo — no category field,
 * matching the backend's SupportTicket schema comment on why this stays
 * simple. */
export interface SupportTicketInput {
  message: string;
  photo?: string;
}

export interface SupportTicketResult {
  id: string;
  createdAt: string;
}
