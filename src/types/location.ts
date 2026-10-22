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
  /** Extra GPS samples collected since the last ping — makes distance accurate. */
  trail?: { latitude: number; longitude: number; accuracy: number; timestamp: string }[];
  /** Catch-up upload of samples saved while offline: the server only stores `trail`, and accepts it for an ended session too. */
  backfill?: boolean;
}

export interface LocationPingResponse {
  tracking: boolean;
  error?: string;
}
