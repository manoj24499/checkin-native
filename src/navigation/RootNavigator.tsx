import { useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/hooks";
import { useSettingsStore } from "@/store/settingsStore";
import { promptBiometricAuth, msSinceLastBiometricPrompt } from "@/services/biometrics";
import { checkTrackingHealth, msSinceLocationTrackingStart } from "@/services/locationTracking";
import { Screen, Button, LoadingView } from "@/components/ui";
import { colors, spacing, typography } from "@/theme";
import { AuthNavigator } from "./AuthNavigator";
import { AppTabs } from "./AppTabs";
import { FaceEnrollmentScreen } from "@/screens/auth/FaceEnrollmentScreen";

// How often to verify the background location task is still actually
// running while it's supposed to be — catches the OS silently killing it
// (aggressive battery optimization on some Android skins) well before the
// admin dashboard's 3-minute "Offline" threshold would otherwise be the
// only signal, and one nobody but an admin ever sees.
const TRACKING_HEALTH_CHECK_MS = 45_000;

// Absorbs the biometric system dialog's own transient background/active
// blip on some Android skins (e.g. MIUI) — without this, a successful
// unlock immediately re-triggers the lock because the OS reports the app as
// having "returned to foreground" the instant the fingerprint dialog closes.
const REAUTH_GRACE_MS = 2000;

// Absorbs the same class of transient blip, but caused by the location
// foreground-service notification instead of the biometric dialog — some
// Android OEM skins report the app as backgrounding/foregrounding the
// instant that notification is posted at check-in. Without this, each blip
// re-triggers the biometric lock overlay, which flashes the tab bar (and,
// via the resulting window-inset churn, the system status bar) on and off
// repeatedly right after checking in.
const TRACKING_START_GRACE_MS = 5000;

function BiometricLockScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <Screen>
      <Text style={styles.lockTitle}>Locked</Text>
      <Text style={styles.lockMessage}>Unlock with Face ID / fingerprint to continue.</Text>
      <Button label="Try again" onPress={onRetry} style={styles.retry} />
    </Screen>
  );
}

export function RootNavigator() {
  const { status, user } = useAuth();
  // Read reactively only for the final render decision below. The two
  // effects deliberately read useSettingsStore.getState() instead of
  // subscribing to this value — they must fire on cold-launch / app-
  // foreground transitions, NOT every time the setting itself changes.
  // Otherwise turning the toggle on in Profile (which already does its own
  // verification before enabling it) immediately re-triggers a second,
  // redundant prompt here.
  const biometricUnlockEnabled = useSettingsStore((s) => s.biometricUnlockEnabled);
  const [unlocked, setUnlocked] = useState(true);
  const appState = useRef(AppState.currentState);
  const isPrompting = useRef(false);

  const requestUnlock = () => {
    if (isPrompting.current) return;
    isPrompting.current = true;
    setUnlocked(false);
    promptBiometricAuth("Unlock Check-In")
      .then(setUnlocked)
      .finally(() => {
        isPrompting.current = false;
      });
  };

  // Gate once when the app finishes signing in (cold launch only).
  useEffect(() => {
    if (status === "authenticated" && useSettingsStore.getState().biometricUnlockEnabled) {
      requestUnlock();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next: AppStateStatus) => {
      const wasBackground = appState.current.match(/inactive|background/);
      appState.current = next;
      // Covers a biometric prompt triggered from ANYWHERE (e.g. Profile's
      // own "enable" flow), not just this component's own requestUnlock —
      // the prompt's dialog can cause this exact foreground transition on
      // its own, regardless of which screen opened it.
      const recentBiometricPrompt = msSinceLastBiometricPrompt() < REAUTH_GRACE_MS;
      const recentTrackingStart = msSinceLocationTrackingStart() < TRACKING_START_GRACE_MS;
      const enabled = useSettingsStore.getState().biometricUnlockEnabled;
      if (
        wasBackground &&
        next === "active" &&
        status === "authenticated" &&
        enabled &&
        !recentBiometricPrompt &&
        !recentTrackingStart &&
        !isPrompting.current
      ) {
        requestUnlock();
      }
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    checkTrackingHealth();
    const interval = setInterval(checkTrackingHealth, TRACKING_HEALTH_CHECK_MS);
    return () => clearInterval(interval);
  }, [status]);

  if (status === "bootstrapping") {
    return <LoadingView label="Signing you in…" animated />;
  }

  if (status !== "authenticated") {
    return <AuthNavigator />;
  }

  // Mandatory, blocking — an employee who wasn't already enrolled with a
  // photo at creation time (see /api/admin/employees) must take a selfie
  // here before reaching the rest of the app. Checked ahead of the
  // biometric lock below since there's nothing to unlock into yet.
  if (user?.role === "EMPLOYEE" && !user.faceVerificationEnabled) {
    return <FaceEnrollmentScreen />;
  }

  // AppTabs stays mounted at all times once authenticated — locking/
  // unlocking only toggles an overlay on top of it. Conditionally rendering
  // AppTabs itself here (swapping it for a lock screen) would unmount and
  // remount the whole tab/native-stack tree on every lock cycle, which both
  // loses navigation state and can desync react-native-screens badly enough
  // to throw "screen was removed natively but didn't get removed from JS
  // state" errors.
  const showLock = biometricUnlockEnabled && !unlocked;

  return (
    <View style={styles.fill}>
      <AppTabs />
      {showLock ? (
        <View style={styles.lockOverlay}>
          <BiometricLockScreen onRetry={requestUnlock} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  lockOverlay: { ...StyleSheet.absoluteFillObject },
  lockTitle: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.sm },
  lockMessage: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.lg },
  retry: { alignSelf: "flex-start" },
});
