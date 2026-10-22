import { create } from "zustand";
import type { AttendanceAction, CheckInMode, KioskStatus } from "@/types";

/**
 * In-memory mirror of the offline check-in queue for the UI. The queue's
 * source of truth (and its persistence) lives in services/offlineQueue.ts —
 * deliberately not zustand `persist`: the PIN and photos of each attempt are
 * kept elsewhere (SecureStore / their own AsyncStorage rows), and only that
 * service may write the queue, so every change is saved in one place.
 */

//  - "pending": saved, waiting to be sent.
//  - "syncing": being sent right now (reset to "pending" on app restart).
//  - "failed": the server rejected it for good (or it got too old) — kept
//    visible with the reason until the employee dismisses it.
//  - "already_recorded": the server already had this check-in/out (409
//    "already checked in/out") — not an error, kept visible until dismissed.
export type OfflineItemStatus = "pending" | "syncing" | "failed" | "already_recorded";

export interface OfflineQueueItem {
  clientId: string;
  action: AttendanceAction;
  employeeCode: string;
  capturedAt: string;
  timeVerified: boolean;
  latitude?: number;
  longitude?: number;
  mocked?: boolean;
  checkInMode?: CheckInMode;
  odometerKm?: number;
  overtimeSummary?: string;
  // The photos themselves are stored separately (see offlineQueue.ts).
  hasPhoto: boolean;
  hasOvertimePhoto: boolean;
  // No local PIN verifier existed when it was saved — the PIN is only
  // checked by the server when it's sent.
  pinUnverified: boolean;
  // CHECK_OUT only: the tracking session that was stopped when it was saved,
  // so cancelling the check-out can resume sharing.
  resumeSession?: { attendanceId: string; checkedInAt: string } | null;
  status: OfflineItemStatus;
  errorMessage?: string;
  errorCode?: string;
  attempts: number;
  createdAt: string;
}

export interface OfflineConfig {
  employeeCode: string;
  enabled: boolean;
  maxAgeMinutes: number;
}

/** Last server status seen, so the app can still show today's state after a cold start offline. */
export interface CachedKioskStatus {
  employeeCode: string;
  dateKey: string;
  status: KioskStatus;
}

export interface OfflineSyncNotice {
  tone: "success" | "warning";
  message: string;
}

interface OfflineQueueState {
  loaded: boolean;
  items: OfflineQueueItem[];
  config: OfflineConfig | null;
  lastStatus: CachedKioskStatus | null;
  notice: OfflineSyncNotice | null;
  setNotice: (notice: OfflineSyncNotice | null) => void;
}

export const useOfflineQueueStore = create<OfflineQueueState>((set) => ({
  loaded: false,
  items: [],
  config: null,
  lastStatus: null,
  notice: null,
  setNotice: (notice) => set({ notice }),
}));
