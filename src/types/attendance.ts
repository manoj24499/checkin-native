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
    };

export interface ScanResult {
  id: string;
  name: string;
  employeeCode: string;
  type: AttendanceAction;
  timestamp: string;
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
}
