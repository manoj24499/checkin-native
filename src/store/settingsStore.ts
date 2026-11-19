import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface SettingsState {
  /** Prompts Face ID/fingerprint on app foreground before showing content. */
  biometricUnlockEnabled: boolean;
  /** Confirm check-in/out with a fingerprint instead of typing the PIN (see services/savedPin.ts). */
  fingerprintCheckinEnabled: boolean;
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
  setFingerprintCheckinEnabled: (value: boolean) => void;
  setShiftRemindersEnabled: (value: boolean) => void;
  setLiveLocationEnabled: (value: boolean) => void;
  setLastOrganizationCode: (value: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      biometricUnlockEnabled: false,
      fingerprintCheckinEnabled: false,
      shiftRemindersEnabled: true,
      liveLocationEnabled: true,
      lastOrganizationCode: "",
      setBiometricUnlockEnabled: (value) => set({ biometricUnlockEnabled: value }),
      setFingerprintCheckinEnabled: (value) => set({ fingerprintCheckinEnabled: value }),
      setShiftRemindersEnabled: (value) => set({ shiftRemindersEnabled: value }),
      setLiveLocationEnabled: (value) => set({ liveLocationEnabled: value }),
      setLastOrganizationCode: (value) => set({ lastOrganizationCode: value }),
    }),
    {
      name: "checkin.settings",
      storage: createJSONStorage(() => AsyncStorage),
      // v1: "Biometric unlock" and "Fingerprint check-in" became one Profile option that sets both flags.
      // Anyone who had either one on keeps fingerprint for both.
      version: 1,
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<SettingsState>;
        if (version < 1) {
          const on = !!(state.biometricUnlockEnabled || state.fingerprintCheckinEnabled);
          return { ...state, biometricUnlockEnabled: on, fingerprintCheckinEnabled: on } as SettingsState;
        }
        return state as SettingsState;
      },
    },
  ),
);
