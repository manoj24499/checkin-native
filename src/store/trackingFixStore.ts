import { create } from "zustand";

/**
 * Controls the "Keep location sharing on" sheet (see TrackingReadinessSheet), which can be opened
 * from the Dashboard's "Fix now" button or as a gate in front of a Field-day check-in.
 */
interface TrackingFixState {
  open: boolean;
  /** Set when opened from check-in: lets the employee carry on with check-in (once fixed, or anyway). */
  onContinue: (() => void) | null;
  show: (onContinue?: () => void) => void;
  close: () => void;
}

export const useTrackingFixStore = create<TrackingFixState>((set) => ({
  open: false,
  onContinue: null,
  show: (onContinue) => set({ open: true, onContinue: onContinue ?? null }),
  close: () => set({ open: false, onContinue: null }),
}));
