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

// The choice a FIELD-workMode employee makes at check-in each day — see
// CheckInOutScreen's Office/Field picker and /api/kiosk/scan.
export type CheckInMode = "OFFICE" | "FIELD";

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
      // From today's CHECK_IN record, if any — survives app restarts/reloads
      // (unlike ScanResult, which only reflects this session's own mutation).
      lateMinutes: number | null;
      leaveType: LeaveType;
      // Only set for FIELD-workMode employees, from today's CHECK_IN. Null
      // before they've checked in yet today.
      checkInMode: CheckInMode | null;
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

export interface ScanResult {
  id: string;
  name: string;
  employeeCode: string;
  type: AttendanceAction;
  timestamp: string;
  lateMinutes: number | null;
  leaveType: LeaveType;
  checkInMode: CheckInMode | null;
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
  // Only sent by FIELD-workMode employees on CHECK_IN — see CheckInOutScreen.
  checkInMode?: CheckInMode;
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
  reachedAt: string;
  latitude: number;
  longitude: number;
}

export interface FieldVisitRequest {
  name: string;
  photo: string;
  latitude: number;
  longitude: number;
}

export type FieldSummary =
  | { active: false }
  | {
      active: true;
      distanceMeters: number;
      route: { latitude: number; longitude: number; timestamp: string }[];
      visits: FieldVisit[];
    };
