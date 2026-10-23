export type AttendanceAction = "CHECK_IN" | "CHECK_OUT";
// QR is kept only so historical records (from before QR was removed) still
// type-check — no new QR-method attendance is produced anymore.
export type AttendanceMethod = "QR" | "PIN";

export interface AttendancePauseInterval {
  pausedAt: string;
  resumedAt: string | null;
}

export interface AttendanceRecord {
  id: string;
  type: AttendanceAction;
  method: AttendanceMethod;
  timestamp: string;
  hasPhoto: boolean;
  pauses?: AttendancePauseInterval[];
}

export interface AttendanceHistoryPage {
  records: AttendanceRecord[];
  nextCursor: string | null;
}

// The choice a FIELD or WFH-workMode employee makes at check-in each day —
// see CheckInOutScreen's Office/Field and Home/Office pickers and
// /api/kiosk/scan. A WFH employee's picker only ever produces "OFFICE" (for
// a day they're actually coming in) or omits this field entirely (an
// ordinary day from home) — there's no "HOME" value, since omitting it
// already means exactly that for a WFH profile.
export type CheckInMode = "OFFICE" | "FIELD";

// A FIELD-workMode employee's *current* Field/Office segment during an
// active check-in — unlike CheckInMode above (fixed for the whole day, set
// once at check-in), this changes over the day: auto-detected via GPS (see
// /api/kiosk/location's evaluateWorkSegment) or manually corrected (see
// useSwitchWorkSegment). Only ever meaningful for FIELD-workMode employees;
// mode is null for everyone else, or when not currently checked in.
export type WorkSegmentMode = "OFFICE" | "FIELD";

export interface WorkSegmentStatus {
  mode: WorkSegmentMode | null;
  startedAt: string | null;
}

export type KioskStatus =
  | { exists: false }
  | {
      exists: true;
      name: string;
      workMode: "OFFICE" | "WFH" | "FIELD";
      checkedIn: boolean;
      checkedOut: boolean;
      checkInAt: string | null;
      checkOutPhotoRequired: boolean;
      isPaused: boolean;
      // Every pause (geofence or timed-permission) against today's CHECK_IN,
      // open or closed — lets the client compute a live, pause-adjusted
      // "worked so far" figure via computeWorkedMs (attendanceGrouping.ts)
      // and a live "outside time" counter for whichever one is still open.
      pauses: AttendancePauseInterval[];
      // From today's CHECK_IN record, if any — survives app restarts/reloads
      // (unlike ScanResult, which only reflects this session's own mutation).
      lateMinutes: number | null;
      leaveType: LeaveType;
      // Only set for FIELD-workMode employees, from today's CHECK_IN. Null
      // before they've checked in yet today.
      checkInMode: CheckInMode | null;
      // Today's assigned shift start/end ("HH:mm", 24-hour, IST) — see
      // /api/kiosk/status. Both null together when no shift is assigned
      // that day (e.g. most FIELD workers) — shiftEndTime alone also
      // restricts the overtime-request time picker.
      shiftStartTime: string | null;
      shiftEndTime: string | null;
      // Organization setting: whether this app may save a check-in/out on
      // the phone while offline and send it later (see services/offlineQueue.ts),
      // and how old such a saved attempt may be when it reaches the server.
      // Optional so an older backend that doesn't send them reads as "off".
      offlineCheckInEnabled?: boolean;
      offlineMaxAgeMinutes?: number;
    };

// Set only for CHECK_IN results, computed server-side from the employee's
// admin-configured shift start time (see /api/kiosk/scan). NONE means either
// on time, or the employee has no shift start time configured.
export type LeaveType = "NONE" | "PERMISSION" | "HALF_DAY";

// A self-declared "pause my work time from X to Y" request during an active
// check-in (e.g. 2:00 PM–4:00 PM) — distinct from the server-computed
// LeaveType.PERMISSION lateness classification above, which is unrelated.
// Requires admin approval before it does anything. See
// RequestTimedPermissionScreen and /api/mobile/me/timed-permission.
//  - "pending": submitted, awaiting an admin decision.
//  - "rejected": declined — terminal, a new request can be submitted.
//  - "scheduled": approved, but its start time hasn't been reached yet.
//  - "active": approved and the linked pause is currently open.
//  - "resolved": the pause has closed (returned in range, or auto-checked-out).
export type TimedPermissionStatus = "pending" | "rejected" | "scheduled" | "active" | "resolved";

export interface TimedPermission {
  id: string;
  startTime: string;
  endTime: string;
  status: TimedPermissionStatus;
}

export interface TimedPermissionRequest {
  startTime: string;
  endTime: string;
}

export type OvertimeRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

// A self-declared "I need to keep working past my normal end" request during
// an active check-in — unlike TimedPermission above, this takes effect the
// moment it's created: the shift-end reminder push uses estimatedEndAt
// instead of the normal shift end right away, and it shows up on the admin
// dashboard immediately. `status` is the admin's after-the-fact
// approve/reject for their own record — it never gates anything the
// employee can already do. See RequestOvertimeScreen and
// /api/mobile/me/overtime.
export interface OvertimeRequest {
  id: string;
  estimatedEndAt: string;
  reason: string;
  status: OvertimeRequestStatus;
  /** True while this is still the active request governing the reminder/
   * checkout flow — false once closed out with a work summary at checkout. */
  active: boolean;
}

export interface OvertimeRequestInput {
  estimatedEndAt: string;
  reason: string;
}

export interface ScanResult {
  id: string;
  name: string;
  employeeCode: string;
  type: AttendanceAction;
  timestamp: string;
  lateMinutes: number | null;
  leaveType: LeaveType;
  checkInMode: CheckInMode | null;
  // Only on an offline upload (ScanRequest.offline): the record was made from
  // a saved attempt, `timestamp` is its capture time, and
  // `offlineOutsideArea` means the saved location was outside the work area
  // (accepted anyway and flagged for the admin — not an error).
  recordedOffline?: boolean;
  offlineOutsideArea?: boolean;
  // The same clientId had already been recorded (an earlier reply was lost).
  idempotentReplay?: boolean;
  // Per-session secret for /api/kiosk/location uploads (sent as X-Tracking-Token).
  // Returned only once, on the response that actually created a CHECK_IN — never
  // on CHECK_OUT or an idempotentReplay. See services/trackingTokens.ts.
  trackingToken?: string;
}

/** Sent only when uploading an attempt saved on the phone while offline. */
export interface ScanOfflineInfo {
  // Idempotency key made on the phone per attempt (16-64 chars, [A-Za-z0-9-]).
  clientId: string;
  // Device clock at the moment of the action (ISO).
  capturedAt: string;
  // Whether the phone could show its clock wasn't changed since its last
  // contact with the server (see recordServerTime in api/client.ts).
  timeVerified: boolean;
}

export interface ScanRequest {
  employeeCode: string;
  pin: string;
  action: AttendanceAction;
  photo?: string;
  latitude?: number;
  longitude?: number;
  // Set when the OS flags the reading as coming from a mock location
  // provider (Android only) — the server rejects check-in outright if true.
  mocked?: boolean;
  // Sent on CHECK_IN by FIELD-workMode employees (their Office/Field choice)
  // and by WFH-workMode employees who chose Office for the day — see
  // CheckInOutScreen. Omitted otherwise, preserving each profile's default.
  checkInMode?: CheckInMode;
  // Only meaningful on CHECK_OUT, and only when the employee has an active
  // OvertimeRequest — optional even then, never required to check out.
  overtimeSummary?: string;
  overtimeSummaryPhoto?: string;
  // Vehicle odometer (km): the start reading on a Field CHECK_IN, the end
  // reading on the matching CHECK_OUT. Required by the app for Field sessions.
  odometerKm?: number;
  // Present only for an offline-saved attempt being sent later — see
  // services/offlineQueue.ts. Requires the bearer token (sent by apiClient).
  offline?: ScanOfflineInfo;
}

// A request for one or more whole calendar days off — distinct from
// TimedPermission (a same-day, hours-long pause during an active check-in)
// and from LeaveType above (an auto-computed lateness classification with a
// confusingly similar name, unrelated to this). Requires admin approval —
// see RequestLeaveScreen and /api/mobile/me/leave-requests.
export type TimeOffType = "CASUAL" | "SICK" | "EARNED";
// CANCELLED: withdrawn by the employee themselves — only ever reachable from
// PENDING (see useCancelLeaveRequest). Terminal, same as REJECTED.
export type TimeOffRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface TimeOffRequest {
  id: string;
  type: TimeOffType;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  status: TimeOffRequestStatus;
  // Only ever set alongside a REJECTED decision.
  reviewNote: string | null;
}

export interface TimeOffRequestInput {
  type: TimeOffType;
  startDate: string;
  endDate: string;
  reason?: string;
}

// This year's quota/used/remaining for one leave type — see
// /api/mobile/me/leave-requests and lib/timeOff.ts (backend). "remaining" is
// always derived server-side from approved days used, never stored.
export interface LeaveBalance {
  type: TimeOffType;
  quota: number;
  used: number;
  remaining: number;
}

export interface PublicHoliday {
  id: string;
  date: string;
  name: string;
}

// A manually-logged stop during a Field day (see CheckInOutScreen's Map tab
// and /api/mobile/field-visits) — distinct from the passive GPS trail.
export interface FieldVisit {
  id: string;
  name: string;
  description?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  remarks?: string | null;
  reachedAt: string;
  latitude: number;
  longitude: number;
}

export interface FieldVisitRequest {
  name: string;
  description?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  remarks?: string;
  photo: string;
  latitude: number;
  longitude: number;
  /** Set when this visit completes a place the admin assigned. */
  assignedPlaceId?: string;
}

// A place an admin assigned to this field worker for a day (see /api/mobile/me/assigned-places).
export type AssignedPlaceStatus = "PENDING" | "VISITED" | "SKIPPED";

export interface AssignedPlace {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  description: string | null;
  contactName: string | null;
  contactPhone: string | null;
  notes: string | null;
  sortOrder: number;
  status: AssignedPlaceStatus;
  skipReason: string | null;
  visitedAt: string | null;
}

/** One turn instruction. `from`/`to` are indices into the route's geometry. */
export interface RouteStep {
  instruction: string;
  /** Maneuver code: 0 left, 1 right, 2 sharp left, 3 sharp right, 4 slight left, 5 slight right,
   * 6 straight, 7 enter roundabout, 8 exit roundabout, 9 u-turn, 10 arrive, 11 depart,
   * 12 keep left, 13 keep right. */
  type: number;
  name: string;
  distanceMeters: number;
  durationSeconds: number;
  from: number;
  to: number;
}

export interface RouteLeg {
  distanceMeters: number;
  durationSeconds: number;
  /** [latitude, longitude] pairs along the road. */
  geometry: [number, number][];
  steps: RouteStep[];
  provider: "openrouteservice" | "straight-line";
}

export interface PlannedPlace extends AssignedPlace {
  /** Distance and time from the previous stop (from the worker for the first one). */
  distanceMeters: number;
  durationSeconds: number;
}

export interface RoutePlan {
  /** True when planned by road distance, false when only straight lines were available. */
  roads: boolean;
  ordered: PlannedPlace[];
  next: { placeId: string; leg: RouteLeg } | null;
}

export type FieldSummary =
  | { active: false }
  | {
      active: true;
      distanceMeters: number;
      route: { latitude: number; longitude: number; timestamp: string }[];
      visits: FieldVisit[];
    };
