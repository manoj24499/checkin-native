export type Role = "ADMIN" | "EMPLOYEE";
// FIELD employees are never geofenced — they can check in from anywhere.
export type WorkMode = "OFFICE" | "WFH" | "FIELD";

export interface EmployeeSummary {
  id: string;
  employeeCode: string;
  name: string;
  email: string;
  role: Role;
  workMode: WorkMode;
  // False until this employee's face is enrolled with the face-verification
  // service — see /api/mobile/me/face-enroll. Gates the mandatory
  // first-login selfie screen in RootNavigator.
  faceVerificationEnabled: boolean;
}

export interface EmployeeProfile extends EmployeeSummary {
  homeLatitude: number | null;
  homeLongitude: number | null;
  homeRadiusMeters: number;
}

/** Response shape of POST /api/mobile/me/face-enroll — see lib/faceVerify.ts
 * (backend) for what each status means. */
export type FaceEnrollResult =
  | { status: "enrolled" }
  | { status: "failed"; message?: string }
  | { status: "unavailable"; message?: string };
