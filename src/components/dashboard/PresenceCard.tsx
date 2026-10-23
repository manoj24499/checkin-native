import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Button, HeroCard, Pill, QuickActions, type ActionTileProps } from "@/components/ui";
import { PING_INTERVAL_MS } from "@/services/locationTracking";
import { useTrackingFixStore } from "@/store/trackingFixStore";
import { formatElapsed, formatDuration, computeWorkedMs } from "@/utils/attendanceGrouping";
import { formatDistance } from "@/utils/geo";
import { colors, radius, spacing, typography } from "@/theme";
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
  /** Present only when checked in but not currently tracking — lets the
   * employee (re)start sharing without checking out (which would end
   * today's attendance for good). */
  onEnableSharing?: () => void;
  enablingSharing?: boolean;
  /** Whether today's session is currently open (checked in, not checked
   * out) — drives the primary tile's label ("Check in" / "Check out")
   * and the big-clock caption. */
  checkedIn: boolean;
  onPrimaryAction: () => void;
  /** Today's check-in only exists on this phone so far (saved offline, see
   * services/offlineQueue.ts) — `checkInAt` is its capture time. */
  pendingSync?: boolean;
  /** Field days: today's tracked distance. When set (and checked in) the
   * hero's big value is the distance, with the worked time as its suffix. */
  distanceMeters?: number | null;
  /** Faded text after the worked-time value (e.g. "of 9h" from the shift). */
  valueSuffix?: string;
  /** Extra white "glass" chips after the status/check-in chips ("Office · 42 m"). */
  chips?: string[];
  /** The three quick-action tiles after the primary Check in/out tile. */
  actions?: (ActionTileProps & { key?: string })[];
}

function formatClock(ms: number) {
  return new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/**
 * Home's lime hero: worked time (or distance, on a Field day), status chips,
 * every presence state (not checked in, sharing live/off, pending sync,
 * paused with outside counters, tracking warning) and the quick-action row.
 */
export function PresenceCard({
  isTracking,
  checkInAt,
  isPaused,
  pauses = [],
  pauseReason = "geofence",
  trackingWarning,
  onEnableSharing,
  enablingSharing,
  checkedIn,
  onPrimaryAction,
  pendingSync,
  distanceMeters,
  valueSuffix,
  chips = [],
  actions = [],
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

  // Status chip — same states as the old "CHECKED IN · SHARING LIVE" kicker.
  const statusPill = isPaused ? (
    <Pill
      variant="warning"
      dot
      label={pauseReason === "permission" ? "Paused · on permission" : "Paused · outside range"}
    />
  ) : checkedIn ? (
    pendingSync ? (
      <Pill variant="white" dot={colors.warning} label="Pending sync" />
    ) : isTracking ? (
      <Pill variant="success" dot label="Live" />
    ) : (
      <Pill variant="glass" dot={colors.textMuted} label="Sharing off" />
    )
  ) : (
    <Pill variant="glass" label="Not checked in" />
  );

  const caption = isPaused
    ? pauseReason === "permission"
      ? "This time won't count while your requested permission is active."
      : "You're outside your assigned area — this time won't count until you're back in range."
    : checkedIn
      ? pendingSync
        ? "Saved on this phone — it's sent automatically when you're back online."
        : "Worked so far today. Stops the moment you check out."
      : "Check in when you arrive.";

  const showDistance = checkedIn && distanceMeters != null;
  const label = showDistance ? "Distance today" : "Worked today";
  const value = showDistance ? formatDistance(distanceMeters) : checkedIn ? formatElapsed(elapsedMs) : "—";
  const suffix = showDistance ? `${formatDuration(elapsedMs)} worked` : checkedIn ? valueSuffix : undefined;

  const pingLabel =
    nextPingSec !== null
      ? `next ping ${Math.floor(nextPingSec / 60)}:${String(nextPingSec % 60).padStart(2, "0")}`
      : "idle";

  return (
    <HeroCard
      label={label}
      labelRight={<Text style={styles.pingLabel}>{pingLabel}</Text>}
      value={value}
      valueSuffix={suffix}
      notch
      style={styles.hero}
    >
      <View style={styles.chipRow}>
        {statusPill}
        {checkedIn && checkInMs ? <Pill variant="glass" label={`In ${formatClock(checkInMs)}`} /> : null}
        {chips.map((c) => (
          <Pill key={c} variant="glass" label={c} />
        ))}
      </View>

      <Text style={styles.caption}>{caption}</Text>

      {isPaused && openPause ? (
        <Pill
          variant="white"
          dot={colors.warning}
          label={`${pauseReason === "permission" ? "On permission" : "Outside"}: ${formatElapsed(outsideMs)}`}
          style={styles.outsidePill}
        />
      ) : null}

      {/* Persists after returning in-range, unlike the live line above —
          this is today's running total across every pause (open or
          closed), not just whichever one is currently open. */}
      {totalOutsideMs > 0 ? (
        <Text style={styles.outsideTotalLabel}>Outside today: {formatDuration(totalOutsideMs)}</Text>
      ) : null}

      {trackingWarning ? (
        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>Location sharing has stopped</Text>
          <Text style={styles.warningText}>{trackingWarning}</Text>
          <Button
            label="Fix now"
            size="sm"
            onPress={() => useTrackingFixStore.getState().show()}
            style={styles.warningButton}
          />
        </View>
      ) : null}

      {onEnableSharing ? (
        <Pill
          variant="ink"
          icon="refresh"
          label={enablingSharing ? "Starting…" : "Turn on live sharing"}
          onPress={enablingSharing ? undefined : onEnableSharing}
          style={styles.enablePill}
        />
      ) : null}

      <QuickActions
        style={styles.actions}
        actions={[
          {
            key: "primary",
            icon: checkedIn ? "logout" : "check",
            // Short tile label; same action as the old "Check in now" button.
            label: checkedIn ? "Check out" : "Check in",
            onPress: onPrimaryAction,
          },
          ...actions,
        ]}
      />
    </HeroCard>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: spacing.md },
  pingLabel: { fontSize: 11, color: colors.onLimeSecondary, fontVariant: ["tabular-nums"] },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm - 2, marginTop: spacing.sm + 2 },
  caption: { ...typography.caption, fontSize: 12, color: colors.onLimeSecondary, marginTop: spacing.sm },
  outsidePill: { marginTop: spacing.sm },
  outsideTotalLabel: {
    ...typography.caption,
    fontSize: 11.5,
    color: colors.inkMuted,
    marginTop: spacing.xs + 2,
  },
  warningBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.tile,
    padding: spacing.sm + 4,
    marginTop: spacing.sm + 2,
  },
  warningTitle: { ...typography.bodyStrong, fontSize: 14, color: colors.warning, marginBottom: 2 },
  warningText: { ...typography.caption, color: colors.textSecondary },
  warningButton: { alignSelf: "flex-start", marginTop: spacing.sm },
  enablePill: { marginTop: spacing.sm + 2 },
  actions: { marginTop: spacing.md },
});
