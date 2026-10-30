import type { EmployeeSummary } from "./employee";

export interface LoginRequest {
  organizationCode: string;
  employeeCode: string;
  pin: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: EmployeeSummary;
}

export interface PinResetVerifyRequest {
  organizationCode: string;
  employeeCode: string;
  code: string;
}

export interface PinResetVerifyResponse {
  resetToken: string;
  name: string;
}

export interface PinResetCompleteRequest {
  resetToken: string;
  newPin: string;
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
