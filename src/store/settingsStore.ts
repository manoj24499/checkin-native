import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface SettingsState {
  /** Prompts Face ID/fingerprint on app foreground before showing content. */
  biometricUnlockEnabled: boolean;
  /** Requests notification permission and syncs the preference server-side
   * (see ProfileScreen's handleShiftRemindersToggle) — the server decides
   * whether to actually push a shift-end/overtime-end reminder based on
   * this. Defaults to true, matching the backend's own default for a
   * never-toggled account. */
  shiftRemindersEnabled: boolean;
  /** Real opt-out: when false, checking in never starts location tracking. */
  liveLocationEnabled: boolean;
  /** Remembered from the last successful login (see LoginScreen) — a device
   * is almost always used by one organization's employees, so prefilling
   * this avoids retyping it every login. Not a secret, unlike employeeCode/
   * PIN, which are never persisted anywhere on the device. */
  lastOrganizationCode: string;
  setBiometricUnlockEnabled: (value: boolean) => void;
  setShiftRemindersEnabled: (value: boolean) => void;
  setLiveLocationEnabled: (value: boolean) => void;
  setLastOrganizationCode: (value: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      biometricUnlockEnabled: false,
      shiftRemindersEnabled: true,
      liveLocationEnabled: true,
      lastOrganizationCode: "",
      setBiometricUnlockEnabled: (value) => set({ biometricUnlockEnabled: value }),
      setShiftRemindersEnabled: (value) => set({ shiftRemindersEnabled: value }),
      setLiveLocationEnabled: (value) => set({ liveLocationEnabled: value }),
      setLastOrganizationCode: (value) => set({ lastOrganizationCode: value }),
    }),
    {
      name: "checkin.settings",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
