import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BarSpark } from "./BarSpark";
import { useActivityPattern } from "@/hooks";
import { PING_INTERVAL_MS } from "@/services/locationTracking";
import { formatElapsed } from "@/utils/attendanceGrouping";
import { colors, radius, spacing, typography } from "@/theme";

interface PresenceCardProps {
  isTracking: boolean;
  checkInAt: string | null;
  isPaused?: boolean;
  trackingWarning?: string | null;
  onViewMap: () => void;
}

export function PresenceCard({ isTracking, checkInAt, isPaused, trackingWarning, onViewMap }: PresenceCardProps) {
  const [now, setNow] = useState(() => Date.now());
  const pings = useActivityPattern(isTracking);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const checkInMs = checkInAt ? new Date(checkInAt).getTime() : null;
  const elapsedMs = checkInMs ? Math.max(0, now - checkInMs) : 0;
  const nextPingSec =
    isTracking && checkInMs
      ? Math.floor((PING_INTERVAL_MS - ((now - checkInMs) % PING_INTERVAL_MS)) / 1000)
      : null;

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.statusRow}>
          <View style={[styles.dot, isPaused && styles.dotPaused]} />
          <Text style={[styles.statusLabel, isPaused && styles.statusLabelPaused]}>
            {isPaused ? "PAUSED — OUTSIDE RANGE" : isTracking ? "SHARING LIVE" : "SHARING OFF"}
          </Text>
        </View>
        <Text style={styles.pingLabel}>
          {nextPingSec !== null
            ? `next ping ${Math.floor(nextPingSec / 60)}:${String(nextPingSec % 60).padStart(2, "0")}`
            : "idle"}
        </Text>
      </View>

      <Text style={styles.elapsed}>{formatElapsed(elapsedMs)}</Text>

      <Text style={styles.whyLine}>
        {isPaused
          ? "You're outside your assigned area — this time won't count until you're back in range."
          : isTracking
            ? "On because you're checked in. Your team sees a dot, not a trail — and it stops the moment you check out."
            : "Off until you check in."}
      </Text>

      {trackingWarning ? (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>{trackingWarning}</Text>
        </View>
      ) : null}

      <View style={styles.divider} />

      <View style={styles.footerRow}>
        <View style={styles.sparkWrap}>
          <BarSpark values={pings} color={isTracking ? colors.primary : "rgba(247,243,239,0.22)"} height={26} />
        </View>
        <Pressable
          onPress={onViewMap}
          style={({ pressed }) => [styles.mapButton, pressed && styles.mapButtonPressed]}
        >
          <Text style={styles.mapButtonLabel}>View on map</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    backgroundColor: colors.panelDark,
    borderWidth: 1,
    borderColor: "rgba(240,100,0,0.30)",
    padding: spacing.md + 2,
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs + 1 },
  dot: { width: 9, height: 9, borderRadius: 99, backgroundColor: colors.primary },
  dotPaused: { backgroundColor: colors.warning },
  statusLabel: { ...typography.label, letterSpacing: 2, color: colors.primarySoftText },
  statusLabelPaused: { color: colors.warning },
  pingLabel: { fontSize: 10, color: "rgba(247,243,239,0.45)", fontVariant: ["tabular-nums"] },
  elapsed: {
    fontSize: 42,
    fontWeight: "300",
    color: colors.textOnDark,
    marginTop: spacing.md,
    fontVariant: ["tabular-nums"],
  },
  whyLine: { ...typography.body, color: colors.textOnDarkMuted, marginTop: spacing.sm, maxWidth: 280 },
  warningBox: {
    backgroundColor: "rgba(184,134,11,0.14)",
    borderWidth: 1,
    borderColor: "rgba(184,134,11,0.35)",
    borderRadius: radius.sm,
    padding: spacing.sm + 2,
    marginTop: spacing.sm,
  },
  warningText: { ...typography.caption, color: colors.warning },
  divider: {
    height: 1,
    backgroundColor: "rgba(247,243,239,0.16)",
    marginVertical: spacing.md,
  },
  footerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  sparkWrap: { flex: 1 },
  mapButton: {
    borderWidth: 1,
    borderColor: "rgba(240,100,0,0.6)",
    borderRadius: radius.sm + 1,
    paddingHorizontal: spacing.md - 3,
    paddingVertical: spacing.sm,
  },
  mapButtonPressed: { backgroundColor: "rgba(240,100,0,0.14)" },
  mapButtonLabel: { ...typography.bodyStrong, color: colors.primarySoftText, fontSize: 12.5 },
});
