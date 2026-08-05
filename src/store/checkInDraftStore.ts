import { create } from "zustand";

/**
 * Holds the in-progress check-in/out photo outside React's component tree,
 * so it survives regardless of whether the CheckIn tab's screen instance
 * gets remounted (e.g. by react-native-screens detaching inactive tabs) —
 * plain component state was getting wiped when switching tabs and back.
 * Intentionally not persisted to disk: this is a short-lived draft, not
 * something that needs to survive an app kill.
 */
interface CheckInDraftState {
  photoDataUrl: string | null;
  setPhotoDataUrl: (photoDataUrl: string | null) => void;
}

export const useCheckInDraftStore = create<CheckInDraftState>((set) => ({
  photoDataUrl: null,
  setPhotoDataUrl: (photoDataUrl) => set({ photoDataUrl }),
}));
