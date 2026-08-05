import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Tracks the *local* live-tracking session: the attendanceId returned by a
 * successful CHECK_IN doubles as the backend's capability token for location
 * pings (see /api/kiosk/location). Persisted so a killed-and-relaunched app
 * (or a background location callback firing before any screen mounts) can
 * still find the active attendanceId.
 */
interface AttendanceSessionState {
  activeAttendanceId: string | null;
  checkedInAt: string | null;
  isTracking: boolean;
  // Not persisted (see partialize below) — a live diagnostic, re-derived
  // each session rather than carried across app restarts. Previously a
  // failure here (denied permission, OS killing the background task) was
  // only ever logged via console.warn — the employee saw check-in succeed
  // with no indication location sharing wasn't actually working.
  trackingWarning: string | null;
  startTracking: (attendanceId: string, checkedInAt: string) => void;
  stopTracking: () => void;
  setTrackingWarning: (warning: string | null) => void;
}

export const useAttendanceSessionStore = create<AttendanceSessionState>()(
  persist(
    (set) => ({
      activeAttendanceId: null,
      checkedInAt: null,
      isTracking: false,
      trackingWarning: null,
      startTracking: (attendanceId, checkedInAt) =>
        set({ activeAttendanceId: attendanceId, checkedInAt, isTracking: true, trackingWarning: null }),
      stopTracking: () =>
        set({ activeAttendanceId: null, checkedInAt: null, isTracking: false, trackingWarning: null }),
      setTrackingWarning: (trackingWarning) => set({ trackingWarning }),
    }),
    {
      name: "checkin.attendanceSession",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        activeAttendanceId: state.activeAttendanceId,
        checkedInAt: state.checkedInAt,
        isTracking: state.isTracking,
      }),
    },
  ),
);
