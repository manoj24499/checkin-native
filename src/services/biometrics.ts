import * as LocalAuthentication from "expo-local-authentication";

export async function isBiometricAuthAvailable(): Promise<boolean> {
  const [hasHardware, isEnrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hasHardware && isEnrolled;
}

// Tracks the last time ANY biometric prompt ran, regardless of which screen
// triggered it (Profile's "enable" flow, RootNavigator's lock screen, etc).
// Showing/dismissing the native prompt itself causes a transient app
// background/foreground blip on some Android skins — callers elsewhere in
// the app (see RootNavigator) use this to avoid mistaking that blip for the
// user having genuinely left and returned.
let lastPromptAt = 0;
// Diagnostic only: the raw failure reason from the last prompt, surfaced by
// ProfileScreen so failures are visible instead of just "didn't work".
let lastError: string | null = null;

export function msSinceLastBiometricPrompt(): number {
  return Date.now() - lastPromptAt;
}

export function getLastBiometricError(): string | null {
  return lastError;
}

export async function promptBiometricAuth(reason = "Unlock to continue"): Promise<boolean> {
  lastPromptAt = Date.now();
  lastError = null;
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: "Cancel",
      // Many budget/OEM-skinned Android devices only expose a "weak"
      // (Class 2) fingerprint sensor, which Android's BiometricPrompt
      // refuses to run in biometric-only mode — it cancels immediately,
      // confusingly reported as `user_cancel` rather than a clear
      // "unsupported" error. Allowing the device-credential fallback keeps
      // biometric unlock actually working on that hardware; the fact that
      // the fallback is the phone's own lock code (not the employee PIN) is
      // explained in the UI copy instead.
      disableDeviceFallback: false,
    });
    if (!result.success) {
      lastError = `${result.error}${result.warning ? ` (${result.warning})` : ""}`;
    }
    return result.success;
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
    console.warn("Biometric prompt failed:", error);
    return false;
  } finally {
    // Mark again on completion too — widens the safe window to cover the
    // dialog's closing transition, not just its opening one.
    lastPromptAt = Date.now();
  }
}
