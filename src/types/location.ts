export interface OfficeLocation {
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

export interface LocationPingRequest {
  attendanceId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: string;
}

export interface LocationPingResponse {
  tracking: boolean;
  error?: string;
}
