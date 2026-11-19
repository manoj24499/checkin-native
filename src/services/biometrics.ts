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

// Errors that mean "the system closed the prompt", not "the employee dismissed it": Android cancels the dialog
// when the app has not finished taking focus (right after launch, behind a permission dialog, while the
// screen is still settling). These are worth silently trying again.
const SYSTEM_CANCEL = /^(system_cancel|app_cancel|timeout|lockout_retry)/;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Same as promptBiometricAuth, but when the system closes the prompt on its own it waits a moment and shows
 * it again (up to `attempts` times) instead of dropping the employee on the lock screen. A real "cancel" by
 * the employee, or a failed fingerprint, is never retried.
 */
export async function promptBiometricAuthPatiently(reason = "Unlock to continue", attempts = 3): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    const startedAt = Date.now();
    const ok = await promptBiometricAuth(reason);
    if (ok) return true;
    if (!lastError || i === attempts - 1) return false;
    // The system closing the dialog on its own: either it says so, or it reports a plain "cancel" within a
    // moment of opening. Some phones label their own dismissal (the window had not regained focus after the
    // app was reopened) as a user cancel, so the error name alone is not enough. An employee who really taps
    // Cancel takes longer than this, and a wrong fingerprint is a different error.
    const closedByItself = SYSTEM_CANCEL.test(lastError) || (/cancel/.test(lastError) && Date.now() - startedAt < 3000);
    if (!closedByItself) return false;
    await sleep(900);
  }
  return false;
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
