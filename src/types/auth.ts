import type { EmployeeSummary } from "./employee";

export interface LoginRequest {
  employeeCode: string;
  pin: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: EmployeeSummary;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface ChangePinRequest {
  currentPin: string;
  newPin: string;
}

export interface ChangePinResponse extends AuthTokens {
  success: true;
}
