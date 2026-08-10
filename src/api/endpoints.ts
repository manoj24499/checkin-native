export const endpoints = {
  mobileLogin: "/api/mobile/login",
  mobileRefresh: "/api/mobile/refresh",
  me: "/api/mobile/me",
  meAttendance: "/api/mobile/me/attendance",
  meAttendancePhoto: (id: string) => `/api/mobile/me/attendance/${id}/photo`,
  changePin: "/api/mobile/change-pin",
  pushToken: "/api/mobile/me/push-token",
  fieldSummary: "/api/mobile/me/field-summary",
  fieldVisits: "/api/mobile/field-visits",
  fieldVisitPhoto: (id: string) => `/api/mobile/field-visits/${id}/photo`,

  kioskScan: "/api/kiosk/scan",
  kioskStatus: "/api/kiosk/status",
  kioskOfficeLocation: "/api/kiosk/office-location",
  kioskLocation: "/api/kiosk/location",
} as const;
