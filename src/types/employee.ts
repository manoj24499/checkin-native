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
}

export interface EmployeeProfile extends EmployeeSummary {
  homeLatitude: number | null;
  homeLongitude: number | null;
  homeRadiusMeters: number;
}
