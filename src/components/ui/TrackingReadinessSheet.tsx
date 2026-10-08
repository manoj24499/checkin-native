import { useCallback, useEffect, useState } from "react";
import { AppState, StyleSheet, Text, View } from "react-native";
import { BottomSheet } from "./BottomSheet";
import { Button } from "./Button";
import { useTrackingFixStore } from "@/store/trackingFixStore";
import {
  checkTrackingReadiness,
  openBatterySettings,
  requestAlwaysLocation,
  type TrackingReadiness,
} from "@/services/trackingReadiness";
import { startLocationTracking } from "@/services/locationTracking";
import { useAttendanceSessionStore } from "@/store/attendanceSessionStore";
import { colors, radius, spacing, typography } from "@/theme";

function Row({ ok, title, hint, action }: { ok: boolean; title: string; hint: string; action?: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={[styles.mark, ok ? styles.markOk : styles.markBad]}>
        <Text style={styles.markText}>{ok ? "✓" : "!"}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowHint}>{hint}</Text>
        {!ok && action ? <View style={styles.rowAction}>{action}</View> : null}
      </View>
    </View>
  );
}

/**
 * "Keep location sharing on": explains the two phone settings that decide whether a field worker's
 * route is recorded all day, checks them live, and links straight to the right screens. Re-checks
 * whenever the app comes back to the foreground, so it updates as soon as they return from Settings.
 */
export function TrackingReadinessSheet() {
  const open = useTrackingFixStore((s) => s.open);
  const onContinue = useTrackingFixStore((s) => s.onContinue);
  const close = useTrackingFixStore((s) => s.close);
  const [state, setState] = useState<TrackingReadiness | null>(null);

  const recheck = useCallback(async () => {
    const next = await checkTrackingReadiness();
    setState(next);
    // Everything is fine now: make sure tracking is actually running again.
    if (next.ok) {
      const s = useAttendanceSessionStore.getState();
      if (s.activeAttendanceId && s.checkedInAt) void startLocationTracking(s.activeAttendanceId, s.checkedInAt);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void recheck();
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") void recheck();
    });
    return () => sub.remove();
  }, [open, recheck]);

  const ok = state?.ok ?? false;
  const proceed = () => {
    const next = onContinue;
    close();
    next?.();
  };

  return (
    <BottomSheet visible={open} onClose={close} kicker="LOCATION SHARING" title="Keep location sharing on">
      <Text style={styles.intro}>
        Your route and distance are only recorded while your phone allows the app to use location in the background.
        Two settings decide that.
      </Text>

      <Row
        ok={!!state?.foreground && !!state?.background}
        title="Location: Allow all the time"
        hint="Without this, Android stops sharing location as soon as the screen turns off."
        action={<Button label="Allow all the time" onPress={() => void requestAlwaysLocation().then(recheck)} />}
      />
      <Row
        ok={state ? !state.batteryRestricted : false}
        title="Battery: don't restrict this app"
        hint="Battery saver is the most common reason tracking stops partway through the day."
        action={<Button label="Turn off battery saving" onPress={() => void openBatterySettings()} />}
      />

      <Text style={styles.oem}>
        On Xiaomi, Oppo, Vivo, Realme and Samsung phones, also allow Autostart (or Run in background) for this app, and
        keep it in your recent apps instead of swiping it away.
      </Text>

      <View style={styles.footer}>
        {ok ? (
          <Button label={onContinue ? "Continue check-in" : "Done"} onPress={proceed} />
        ) : onContinue ? (
          <Button label="Check in anyway" variant="secondary" onPress={proceed} />
        ) : (
          <Button label="Close" variant="secondary" onPress={close} />
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  intro: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm, marginBottom: spacing.md },
  row: { flexDirection: "row", gap: spacing.sm + 2, marginBottom: spacing.md },
  mark: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", marginTop: 2 },
  markOk: { backgroundColor: colors.success },
  markBad: { backgroundColor: colors.danger },
  markText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  rowBody: { flex: 1 },
  rowTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  rowHint: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  rowAction: { marginTop: spacing.sm, alignSelf: "flex-start" },
  oem: {
    ...typography.caption,
    color: colors.textSecondary,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    padding: spacing.sm + 2,
    marginBottom: spacing.md,
  },
  footer: { marginTop: spacing.xs },
});
