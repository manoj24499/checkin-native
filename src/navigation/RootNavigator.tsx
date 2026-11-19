import { useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus, StyleSheet, Text, View } from "react-native";
import { useAuth, useHybridPushHandling } from "@/hooks";
import { useSettingsStore } from "@/store/settingsStore";
import { promptBiometricAuthPatiently, msSinceLastBiometricPrompt, getLastBiometricError } from "@/services/biometrics";
import { checkTrackingHealth, msSinceLocationTrackingStart } from "@/services/locationTracking";
import { Screen, Button, IconTile, LoadingView, TrackingReadinessSheet } from "@/components/ui";
import { LogoMark } from "@/components/branding/LogoMark";
import { colors, spacing, typography } from "@/theme";
import { AuthNavigator } from "./AuthNavigator";
import { AppTabs } from "./AppTabs";
import { BiometricLockScreen } from "@/screens/auth/BiometricLockScreen";
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

// The lock only comes back if the app was really away for at least this long. Android system dialogs and
// services (the location permission prompt, the map screen starting the GPS, the tracking notification)
// make the app report "inactive"/"background" and "active" again within a second or two — that is not the
// employee leaving, and asking for the fingerprint each time they open the Map tab was a bug. Genuinely
// leaving the app (switching apps, locking the phone) takes far longer than this.
const MIN_AWAY_FOR_RELOCK_MS = 8000;

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
  const leftAppAt = useRef<number | null>(null);
  // Taps on the HYBRID "Heading home?" / "Are you home yet?" pushes open Home.
  useHybridPushHandling(status === "authenticated");

  // Why the last prompt closed without unlocking, shown small on the lock screen so a problem can be diagnosed.
  const [unlockDetail, setUnlockDetail] = useState<string | null>(null);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const requestUnlock = () => {
    if (isPrompting.current) return;
    isPrompting.current = true;
    setUnlocked(false);
    setUnlockDetail(null);
    promptBiometricAuthPatiently("Unlock Check-In")
      .then((ok) => {
        if (!ok) setUnlockDetail(getLastBiometricError());
        setUnlocked(ok);
      })
      .finally(() => {
        isPrompting.current = false;
      });
  };

  // Coming back to the app: lock at once (so nothing is readable), but give Android a moment to bring the
  // window back before the fingerprint dialog opens. Opening it the instant the app turns active made the
  // system close it again after about two seconds.
  const requestUnlockAfterResume = () => {
    setUnlocked(false);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => {
      resumeTimer.current = null;
      if (AppState.currentState === "active") requestUnlock();
    }, 900);
  };

  // Gate once when the app finishes signing in (cold launch only). Showing the prompt the instant the app
  // starts made Android close it after about two seconds (the window had not taken focus yet), leaving the
  // employee on the lock screen until they tapped "Try again". So: wait until the app is really in the
  // foreground, give it a moment to settle, and the prompt itself retries if the system still cancels it.
  useEffect(() => {
    if (status !== "authenticated" || !useSettingsStore.getState().biometricUnlockEnabled) return;
    setUnlocked(false);
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let sub: { remove: () => void } | undefined;
    const start = () => {
      timer = setTimeout(() => {
        if (!cancelled) requestUnlock();
      }, 600);
    };
    if (AppState.currentState === "active") {
      start();
    } else {
      sub = AppState.addEventListener("change", (next) => {
        if (next === "active" && !timer) start();
      });
    }
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      sub?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next: AppStateStatus) => {
      const wasBackground = appState.current.match(/inactive|background/);
      appState.current = next;
      if (next !== "active") {
        if (leftAppAt.current === null) leftAppAt.current = Date.now();
        return;
      }
      const awayMs = leftAppAt.current === null ? Infinity : Date.now() - leftAppAt.current;
      leftAppAt.current = null;
      // Covers a biometric prompt triggered from ANYWHERE (e.g. Profile's
      // own "enable" flow), not just this component's own requestUnlock —
      // the prompt's dialog can cause this exact foreground transition on
      // its own, regardless of which screen opened it.
      const recentBiometricPrompt = msSinceLastBiometricPrompt() < REAUTH_GRACE_MS;
      const recentTrackingStart = msSinceLocationTrackingStart() < TRACKING_START_GRACE_MS;
      const enabled = useSettingsStore.getState().biometricUnlockEnabled;
      if (
        wasBackground &&
        awayMs >= MIN_AWAY_FOR_RELOCK_MS &&
        status === "authenticated" &&
        enabled &&
        !recentBiometricPrompt &&
        !recentTrackingStart &&
        !isPrompting.current
      ) {
        requestUnlockAfterResume();
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
    return <LoadingView label="Signing you in…" animated fullScreen />;
  }

  if (status !== "authenticated") {
    return <AuthNavigator />;
  }

  // Mandatory, blocking — an employee who wasn't already enrolled with a
  // photo at creation time (see /api/admin/employees) must take a selfie
  // here before reaching the rest of the app. Checked ahead of the
  // biometric lock below since there's nothing to unlock into yet.
  // faceVerificationExempt is the admin's escape hatch for someone who's
  // stuck here (bad camera, policy exemption, ...) — see its schema comment
  // on the backend for why it bypasses this gate without also flipping
  // faceVerificationEnabled on.
  if (user?.role === "EMPLOYEE" && !user.faceVerificationEnabled && !user.faceVerificationExempt) {
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
      <TrackingReadinessSheet />
      {showLock ? (
        <View style={styles.lockOverlay}>
          <BiometricLockScreen onRetry={requestUnlock} detail={unlockDetail} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  lockOverlay: { ...StyleSheet.absoluteFillObject },
  lockContent: { justifyContent: "space-between", paddingVertical: spacing.lg },
  lockBody: { alignItems: "center" },
  lockTitle: { ...typography.h1, color: colors.ink, marginTop: spacing.lg, marginBottom: spacing.sm },
  lockMessage: { ...typography.body, color: colors.textSecondary, textAlign: "center", maxWidth: 280 },
  retry: { alignSelf: "stretch" },
});
