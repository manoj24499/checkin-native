import * as SecureStore from "expo-secure-store";

/**
 * "Fingerprint check-in": the PIN the server last accepted is kept in the phone's secure storage (Keystore /
 * Keychain) so the employee can confirm with a fingerprint instead of typing it. The PIN is only released
 * after a successful biometric prompt (see CheckInOutScreen), and the server still verifies it on every
 * check-in/out, so this is a convenience, not a new way to prove identity.
 */

// SecureStore keys only allow [A-Za-z0-9._-].
const key = (employeeCode: string) => `checkin.savedPin.${employeeCode.replace(/[^A-Za-z0-9._-]/g, "_")}`;

export async function saveFingerprintPin(employeeCode: string, pin: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key(employeeCode), pin);
  } catch {
    // Best effort — without it the employee just types the PIN.
  }
}

export async function readFingerprintPin(employeeCode: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key(employeeCode));
  } catch {
    return null;
  }
}

export async function hasFingerprintPin(employeeCode: string): Promise<boolean> {
  return !!(await readFingerprintPin(employeeCode));
}

export async function clearFingerprintPin(employeeCode: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key(employeeCode));
  } catch {
    // Nothing to clear.
  }
}
