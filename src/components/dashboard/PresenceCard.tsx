import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Path } from "react-native-svg";
import { PING_INTERVAL_MS } from "@/services/locationTracking";
import { formatElapsed, formatDuration, computeWorkedMs } from "@/utils/attendanceGrouping";
import { colors, radius, spacing, typography, fontFamily } from "@/theme";
import type { AttendancePauseInterval } from "@/types";

interface PresenceCardProps {
  isTracking: boolean;
  checkInAt: string | null;
  isPaused?: boolean;
  /** Every pause (open or closed) against today's active check-in — used to
   * net real pause time out of the live elapsed clock below, and to drive
   * the live "outside time" counter for whichever pause is still open. */
  pauses?: AttendancePauseInterval[];
  /** Why the pause is open — a self-declared timed permission reads very
   * differently from an auto-detected geofence departure, even though both
   * are the same underlying `isPaused` flag. Ignored while `isPaused` is
   * false. Defaults to "geofence" (the original, only reason before timed
   * permissions existed). */
  pauseReason?: "geofence" | "permission";
  trackingWarning?: string | null;
  onViewMap: () => void;
  /** Present only when checked in but not currently tracking — lets the
   * employee (re)start sharing without checking out (which would end
   * today's attendance for good). */
  onEnableSharing?: () => void;
  enablingSharing?: boolean;
  /** Whether today's session is currently open (checked in, not checked
   * out) — drives the primary action's label ("Check in now" / "Check
   * out") and the big-clock caption. */
  checkedIn: boolean;
  onPrimaryAction: () => void;
}

export function PresenceCard({
  isTracking,
  checkInAt,
  isPaused,
  pauses = [],
  pauseReason = "geofence",
  trackingWarning,
  onViewMap,
  onEnableSharing,
  enablingSharing,
  checkedIn,
  onPrimaryAction,
}: PresenceCardProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const checkInMs = checkInAt ? new Date(checkInAt).getTime() : null;
  // Nets out every pause today (not just the current one), so the figure
  // stays correct even after multiple separate out-of-range spells in one
  // shift — same computeWorkedMs the backend uses for closed sessions,
  // just given "now" in place of a real checkout.
  const elapsedMs = checkInMs ? computeWorkedMs(new Date(checkInMs), new Date(now), pauses) : 0;
  const openPause = pauses.find((p) => !p.resumedAt) ?? null;
  const outsideMs = openPause ? Math.max(0, now - new Date(openPause.pausedAt).getTime()) : 0;
  // Total paused today (closed pauses + the current one if still open) —
  // derived from the two figures already computed above rather than a
  // second reduce over `pauses`, since worked + paused always equals the
  // raw elapsed time by construction.
  const totalOutsideMs = checkInMs ? Math.max(0, now - checkInMs - elapsedMs) : 0;
  const nextPingSec =
    isTracking && checkInMs
      ? Math.floor((PING_INTERVAL_MS - ((now - checkInMs) % PING_INTERVAL_MS)) / 1000)
      : null;

  const statusKicker = isPaused
    ? pauseReason === "permission"
      ? "PAUSED — ON PERMISSION"
      : "PAUSED — OUTSIDE RANGE"
    : checkedIn
      ? isTracking
        ? "CHECKED IN · SHARING LIVE"
        : "CHECKED IN · SHARING OFF"
      : "NOT CHECKED IN";

  const caption = isPaused
    ? pauseReason === "permission"
      ? "This time won't count while your requested permission is active."
      : "You're outside your assigned area — this time won't count until you're back in range."
    : checkedIn
      ? "Worked so far today. Stops the moment you check out."
      : "Check in when you arrive.";

  return (
    <LinearGradient
      colors={["#FFF1E4", "#FFF8F2", "#FFFFFF"]}
      locations={[0, 0.55, 1]}
      start={{ x: 0.15, y: 0 }}
      end={{ x: 0.75, y: 1 }}
      style={styles.card}
    >
      {/* Decorative glow blob — an approximation of the mockup's radial
       * gradient (RN's LinearGradient can't do radial), a soft translucent
       * circle reads close enough at this size. */}
      <View pointerEvents="none" style={styles.glow} />

      <View style={styles.row}>
        <View style={styles.statusRow}>
          <View style={[styles.dot, (isPaused || !checkedIn) && styles.dotMuted]} />
          <Text style={styles.statusLabel}>{statusKicker}</Text>
        </View>
        <Text style={styles.pingLabel}>
          {nextPingSec !== null
            ? `next ping ${Math.floor(nextPingSec / 60)}:${String(nextPingSec % 60).padStart(2, "0")}`
            : "idle"}
        </Text>
      </View>

      <Text style={styles.elapsed}>{checkedIn ? formatElapsed(elapsedMs) : "—"}</Text>
      <Text style={styles.caption}>{caption}</Text>

      {isPaused && openPause ? (
        <View style={styles.outsideRow}>
          <View style={styles.outsideDot} />
          <Text style={styles.outsideLabel}>
            {pauseReason === "permission" ? "On permission" : "Outside"}: {formatElapsed(outsideMs)}
          </Text>
        </View>
      ) : null}

      {/* Persists after returning in-range, unlike the live line above —
          this is today's running total across every pause (open or
          closed), not just whichever one is currently open. */}
      {totalOutsideMs > 0 ? (
        <Text style={styles.outsideTotalLabel}>Outside today: {formatDuration(totalOutsideMs)}</Text>
      ) : null}

      {trackingWarning ? (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>{trackingWarning}</Text>
        </View>
      ) : null}

      <View style={styles.actionRow}>
        <Pressable
          onPress={onPrimaryAction}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
        >
          <Text style={styles.primaryButtonLabel}>{checkedIn ? "Check out" : "Check in now"}</Text>
        </Pressable>
        <Pressable
          onPress={onViewMap}
          style={({ pressed }) => [styles.mapButton, pressed && styles.mapButtonPressed]}
        >
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 21s-7-5.4-7-11a7 7 0 0 1 14 0c0 5.6-7 11-7 11z"
              stroke={colors.textSecondary}
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Circle cx={12} cy={10} r={2.5} stroke={colors.textSecondary} strokeWidth={1.6} />
          </Svg>
        </Pressable>
      </View>

      {onEnableSharing ? (
        <Pressable
          onPress={onEnableSharing}
          disabled={enablingSharing}
          style={({ pressed }) => [styles.enableButton, pressed && styles.enableButtonPressed]}
        >
          <Text style={styles.enableButtonLabel}>
            {enablingSharing ? "Starting…" : "Turn on live sharing"}
          </Text>
        </Pressable>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
    padding: spacing.md + 2,
    overflow: "hidden",
  },
  glow: {
    position: "absolute",
    top: -40,
    right: -30,
    width: 150,
    height: 150,
    borderRadius: 999,
    backgroundColor: "rgba(239,108,0,0.10)",
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs + 1 },
  dot: { width: 9, height: 9, borderRadius: 99, backgroundColor: colors.primary },
  dotMuted: { backgroundColor: colors.textMuted },
  statusLabel: { ...typography.label, letterSpacing: 2, color: colors.primaryDark, fontSize: 10 },
  pingLabel: { fontSize: 10, color: colors.textSecondary, fontVariant: ["tabular-nums"] },
  elapsed: {
    fontSize: 42,
    fontFamily: fontFamily.regular,
    fontWeight: "300",
    color: colors.textPrimary,
    marginTop: spacing.md,
    fontVariant: ["tabular-nums"],
    letterSpacing: -0.5,
  },
  caption: { ...typography.caption, color: colors.primaryDark, marginTop: spacing.xs },
  outsideRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
    marginTop: spacing.sm,
  },
  outsideDot: { width: 6, height: 6, borderRadius: 99, backgroundColor: colors.warning },
  outsideLabel: {
    ...typography.bodyStrong,
    fontSize: 12.5,
    color: colors.warning,
    fontVariant: ["tabular-nums"],
  },
  outsideTotalLabel: {
    ...typography.caption,
    fontSize: 11.5,
    color: colors.textSecondary,
    marginTop: spacing.xs + 2,
  },
  warningBox: {
    backgroundColor: colors.warningMuted,
    borderWidth: 1,
    borderColor: "rgba(184,134,11,0.35)",
    borderRadius: radius.sm,
    padding: spacing.sm + 2,
    marginTop: spacing.sm,
  },
  warningText: { ...typography.caption, color: colors.warning },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  primaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonPressed: { backgroundColor: colors.primaryMuted },
  primaryButtonLabel: { ...typography.bodyStrong, color: colors.primaryDark },
  mapButton: {
    width: 44,
    minHeight: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  mapButtonPressed: { backgroundColor: colors.primaryMuted },
  enableButton: { alignSelf: "flex-start", marginTop: spacing.sm },
  enableButtonPressed: { opacity: 0.6 },
  enableButtonLabel: { ...typography.bodyStrong, color: colors.primaryDark, fontSize: 12.5 },
});
