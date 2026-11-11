import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from "react-native-svg";
import {
  Button,
  GlowPanel,
  LivePill,
  Icon,
  PulseRing,
  QuickActions,
  StatBox,
  StatRow,
  useReducedMotion,
  type ActionTileProps,
} from "@/components/ui";
import { PING_INTERVAL_MS } from "@/services/locationTracking";
import { useTrackingFixStore } from "@/store/trackingFixStore";
import { formatElapsed, formatDuration, computeWorkedMs } from "@/utils/attendanceGrouping";
import { formatDistance } from "@/utils/geo";
import { colors, fontFamilies, gradients, radius, spacing, typography } from "@/theme";
import type { AttendancePauseInterval } from "@/types";

const AnimatedPath = Animated.createAnimatedComponent(Path);

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
   * false. Defaults to "geofence". */
  pauseReason?: "geofence" | "permission";
  trackingWarning?: string | null;
  /** Present only when checked in but not currently tracking — lets the
   * employee (re)start sharing without checking out (which would end
   * today's attendance for good). */
  onEnableSharing?: () => void;
  enablingSharing?: boolean;
  /** Whether today's session is currently open (checked in, not checked
   * out) — drives the CTA label ("Check in" / "Check out") and caption. */
  checkedIn: boolean;
  onPrimaryAction: () => void;
  /** Today's check-in only exists on this phone so far (saved offline, see
   * services/offlineQueue.ts) — `checkInAt` is its capture time. */
  pendingSync?: boolean;
  /** Field days: today's tracked distance. When set (and checked in) the
   * big value is the distance, with the worked time under it. */
  distanceMeters?: number | null;
  /** Today's shift ("HH:mm" start/end). Drives the gauge's scale (worked /
   * shift length), "of 9h · 63% of shift" and the arc's end labels. */
  shift?: { start: string | null; end: string | null } | null;
  /** Today's timed permission window (ISO) — drawn as a segment on the arc
   * and listed in the legend. */
  permission?: { startTime: string; endTime: string } | null;
  /** HYBRID: travel time to leave out of the live worked figure — `baseMs`
   * already counted (as of the last status fetch) plus, while a transit is
   * open and not paused, the time since `liveSince` (epoch ms). */
  transit?: { baseMs: number; liveSince: number | null };
  /** IN AT / MODE / RANGE row under the gauge. */
  stats?: { inAt: string; mode: string; range: string; rangeWarn?: boolean };
  /** Quick tiles at the bottom of the panel (4 per row; 5+ wrap into rows of 3). */
  actions?: (ActionTileProps & { key?: string })[];
}

const pad = (n: number) => String(n).padStart(2, "0");

// ---- Gauge geometry (Main.dc.html: 310x182 viewBox, r=130 semicircle centred at 155,150) ----
const GW = 310;
const GH = 182;
const CX = 155;
const CY = 150;
const R = 130;
const ARC = Math.PI * R; // 408.4
const ARC_D = `M${CX - R} ${CY} A${R} ${R} 0 0 1 ${CX + R} ${CY}`;
const TICKS_D = [0, 20, 40, 60, 80, 100, 120, 140, 160, 180]
  .map((deg) => {
    const a = (deg * Math.PI) / 180;
    const p = (r: number) => `${(CX - r * Math.cos(a)).toFixed(1)} ${(CY - r * Math.sin(a)).toFixed(1)}`;
    return `M${p(104)}L${p(112)}`;
  })
  .join("");
/** Nominal day used to scale the arc when the employee has no shift. */
const NOMINAL_DAY_MS = 8 * 3_600_000;
const DRAW_EASING = Easing.bezier(0.3, 0.7, 0.2, 1);

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

function clockLabel(d: Date) {
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/** Today's shift window as real dates (overnight shifts wrap; before an overnight shift's end, it began yesterday). */
function shiftWindow(shift: PresenceCardProps["shift"], now: number) {
  if (!shift?.start || !shift?.end) return null;
  const startMin = toMin(shift.start);
  const lengthMin = (toMin(shift.end) - startMin + 1440) % 1440;
  if (!lengthMin || !Number.isFinite(lengthMin)) return null;
  const start = new Date(now);
  start.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
  if (start.getTime() > now && start.getTime() + lengthMin * 60_000 - 86_400_000 > now) {
    start.setDate(start.getDate() - 1);
  }
  const startMs = start.getTime();
  return { startMs, endMs: startMs + lengthMin * 60_000, lengthMin };
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Home's dark presence panel (Main.dc.html): status chip + next ping, the semicircular worked-time gauge (track,
 * permission segment, gradient progress arc, ticks, needle with a pulsing dot, shift end labels) around the
 * live timer, legend, every presence state (sharing off, pending sync, paused with outside counters, tracking
 * warning), the IN AT / MODE / RANGE boxes, the check in/out pill and the quick tiles.
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
  shift,
  permission,
  transit,
  stats,
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
  const pauseAdjustedMs = checkInMs ? computeWorkedMs(new Date(checkInMs), new Date(now), pauses) : 0;
  // HYBRID: travel between office and home isn't work time.
  const transitMs = transit ? transit.baseMs + (transit.liveSince ? Math.max(0, now - transit.liveSince) : 0) : 0;
  const elapsedMs = checkedIn ? Math.max(0, pauseAdjustedMs - transitMs) : 0;
  const openPause = pauses.find((p) => !p.resumedAt) ?? null;
  const outsideMs = openPause ? Math.max(0, now - new Date(openPause.pausedAt).getTime()) : 0;
  // Total paused today (closed pauses + the current one if still open).
  const totalOutsideMs = checkInMs ? Math.max(0, now - checkInMs - pauseAdjustedMs) : 0;
  const nextPingSec =
    isTracking && checkInMs
      ? Math.floor((PING_INTERVAL_MS - ((now - checkInMs) % PING_INTERVAL_MS)) / 1000)
      : null;

  // ---- Gauge numbers ----
  const win = shiftWindow(shift, now);
  const scaleMs = win ? win.lengthMin * 60_000 : NOMINAL_DAY_MS;
  const progress = clamp01(elapsedMs / scaleMs);
  const pct = win ? Math.round((elapsedMs / scaleMs) * 100) : null;
  const shiftLen = win ? `${Math.floor(win.lengthMin / 60)}h${win.lengthMin % 60 ? ` ${win.lengthMin % 60}m` : ""}` : null;

  // Permission segment on the arc (clock time across the shift, as in the mockup).
  let permSeg: { start: number; len: number } | null = null;
  if (win && permission) {
    const s = clamp01((new Date(permission.startTime).getTime() - win.startMs) / (win.endMs - win.startMs));
    const e = clamp01((new Date(permission.endTime).getTime() - win.startMs) / (win.endMs - win.startMs));
    if (e > s) permSeg = { start: s * ARC, len: (e - s) * ARC };
  }

  const showDistance = checkedIn && distanceMeters != null;
  const totalSec = Math.floor(elapsedMs / 1000);
  const timer = `${pad(Math.floor(totalSec / 3600))}:${pad(Math.floor((totalSec % 3600) / 60))}:${pad(totalSec % 60)}`;
  const subLine = showDistance
    ? `${formatDuration(elapsedMs)} worked${shiftLen ? ` of ${shiftLen}` : ""}`
    : checkedIn
      ? shiftLen
        ? `of ${shiftLen} · ${pct}% of shift`
        : null
      : shiftLen
        ? `${shiftLen} shift today`
        : null;

  // Status chip: Live (green, pulsing) or one of the other presence states.
  const chip: { label: string; fg: string; bg: string; border?: string } | "live" = isPaused
    ? { label: pauseReason === "permission" ? "Paused · on permission" : "Paused · outside range", fg: AMBER, bg: AMBER_BG }
    : checkedIn
      ? pendingSync
        ? { label: "Pending sync", fg: AMBER, bg: AMBER_BG }
        : isTracking
          ? "live"
          : { label: "Sharing off", fg: colors.panelHeroMuted, bg: "transparent", border: colors.panelHeroLine }
      : { label: "Not checked in", fg: colors.panelHeroMuted, bg: "transparent", border: colors.panelHeroLine };

  // Only the out-of-the-ordinary states get a caption (the mockup's normal state has none).
  const caption = isPaused
    ? pauseReason === "permission"
      ? "This time won't count while your requested permission is active."
      : "You're outside your assigned area — this time won't count until you're back in range."
    : checkedIn
      ? pendingSync
        ? "Saved on this phone — it's sent automatically when you're back online."
        : transit?.liveSince
          ? "You're travelling — travel time isn't counted as work."
          : null
      : "Check in when you arrive.";

  // ---- Animations: arc + needle draw in (1.8s after .3s), ticks fade (.6s), permission segment (1.6s) ----
  const reduced = useReducedMotion();
  const drawJs = useRef(new Animated.Value(0)).current; // svg props (JS driver)
  const drawNative = useRef(new Animated.Value(0)).current; // needle rotation (native)
  const ticksIn = useRef(new Animated.Value(0)).current;
  const permIn = useRef(new Animated.Value(0)).current;
  const arcLen = useRef(new Animated.Value(progress * ARC)).current;
  const needleDeg = useRef(new Animated.Value(progress * 180)).current;

  useEffect(() => {
    arcLen.setValue(progress * ARC);
    needleDeg.setValue(progress * 180);
  }, [progress, arcLen, needleDeg]);

  useEffect(() => {
    if (reduced) {
      [drawJs, drawNative, ticksIn, permIn].forEach((v) => v.setValue(1));
      return;
    }
    const anim = Animated.parallel([
      Animated.timing(drawJs, { toValue: 1, duration: 1800, delay: 300, easing: DRAW_EASING, useNativeDriver: false }),
      Animated.timing(drawNative, { toValue: 1, duration: 1800, delay: 300, easing: DRAW_EASING, useNativeDriver: true }),
      Animated.timing(ticksIn, { toValue: 1, duration: 800, delay: 600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(permIn, { toValue: 1, duration: 600, delay: 1600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [reduced, drawJs, drawNative, ticksIn, permIn]);

  const dashOffset = useMemo(() => Animated.subtract(ARC, Animated.multiply(drawJs, arcLen)), [drawJs, arcLen]);
  const needleRotate = useMemo(
    () =>
      Animated.multiply(drawNative, needleDeg).interpolate({ inputRange: [0, 180], outputRange: ["0deg", "180deg"] }),
    [drawNative, needleDeg],
  );

  // Fit the 310px gauge on narrow phones (page gutter 20 + panel padding 18 + border).
  const { width: windowWidth } = useWindowDimensions();
  const scale = Math.min(1, (windowWidth - 2 * spacing.gutter - 2 * 18 - 2) / GW);

  const tileRows =
    actions.length <= 4 ? [actions] : [actions.slice(0, 3), actions.slice(3, 6), actions.slice(6)].filter((r) => r.length);

  return (
    <GlowPanel rounded>
      <View style={styles.headerRow}>
        {chip === "live" ? (
          <LivePill />
        ) : (
          <View style={[styles.chip, { backgroundColor: chip.bg }, chip.border ? { borderWidth: 1, borderColor: chip.border } : null]}>
            <View style={[styles.chipDot, { backgroundColor: chip.fg }]} />
            <Text style={[styles.chipLabel, { color: chip.fg }]} numberOfLines={1}>
              {chip.label}
            </Text>
          </View>
        )}
        {nextPingSec !== null ? (
          <Text style={styles.pingLabel}>{`Next ping in ${Math.floor(nextPingSec / 60)}:${pad(nextPingSec % 60)}`}</Text>
        ) : null}
      </View>

      {/* Gauge */}
      <View style={[styles.gaugeOuter, { width: GW * scale, height: GH * scale }]}>
        <View
          style={[
            styles.gauge,
            { left: (GW * scale - GW) / 2, top: (GH * scale - GH) / 2, transform: [{ scale }] },
          ]}
        >
          <Svg width={GW} height={GH} viewBox={`0 0 ${GW} ${GH}`} style={StyleSheet.absoluteFill}>
            <Defs>
              <SvgGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={gradients.gauge[0]} />
                <Stop offset="1" stopColor={gradients.gauge[1]} />
              </SvgGradient>
            </Defs>
            <Path d={ARC_D} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={16} strokeLinecap="round" />
            {progress > 0 ? (
              <AnimatedPath
                d={ARC_D}
                fill="none"
                stroke="url(#gaugeGrad)"
                strokeWidth={16}
                strokeLinecap="round"
                strokeDasharray={`${ARC} ${ARC}`}
                strokeDashoffset={dashOffset}
              />
            ) : null}
          </Svg>
          {permSeg ? (
            <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: permIn }]}>
              <Svg width={GW} height={GH} viewBox={`0 0 ${GW} ${GH}`}>
                <Path
                  d={ARC_D}
                  fill="none"
                  stroke="rgba(255,200,90,0.6)"
                  strokeWidth={16}
                  strokeDasharray={`0 ${permSeg.start} ${permSeg.len} ${ARC}`}
                />
              </Svg>
            </Animated.View>
          ) : null}
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: ticksIn }]}>
            <Svg width={GW} height={GH} viewBox={`0 0 ${GW} ${GH}`}>
              <Path d={TICKS_D} stroke="rgba(247,243,239,0.4)" strokeWidth={1.6} strokeLinecap="round" />
            </Svg>
          </Animated.View>

          {/* Needle: a bar centred on the arc's centre, rotated 0..180deg with the dot at its left end. */}
          <Animated.View pointerEvents="none" style={[styles.needle, { transform: [{ rotate: needleRotate }] }]}>
            <View style={styles.needlePulse}>
              <PulseRing size={22} color="rgba(255,255,255,0.25)" scaleTo={2.8} duration={2000} enabled={checkedIn} />
            </View>
            <View style={styles.needleRing} />
            <View style={styles.needleDot} />
          </Animated.View>

          {win ? (
            <>
              <Text style={[styles.endLabel, { left: CX - R - 30 }]}>{clockLabel(new Date(win.startMs))}</Text>
              <Text style={[styles.endLabel, { left: CX + R - 30 }]}>{clockLabel(new Date(win.endMs))}</Text>
            </>
          ) : null}

          <View style={styles.centre} pointerEvents="none">
            <Text style={styles.centreKicker}>{showDistance ? "DISTANCE TODAY" : "WORKED TODAY"}</Text>
            <Text style={styles.timer} numberOfLines={1} adjustsFontSizeToFit>
              {showDistance ? formatDistance(distanceMeters) : timer}
            </Text>
            {subLine ? <Text style={styles.centreSub}>{subLine}</Text> : null}
          </View>
        </View>
      </View>

      <View style={styles.legend}>
        <LegendItem swatch={styles.swWorked} label="Worked" />
        {permission ? (
          <LegendItem swatch={styles.swPermission} label={`Permission ${clockLabel(new Date(permission.startTime))}`} />
        ) : null}
        <LegendItem swatch={styles.swRemaining} label="Remaining" />
      </View>

      {caption || (isPaused && openPause) || totalOutsideMs > 0 ? (
        <View style={styles.notes}>
          {caption ? <Text style={styles.caption}>{caption}</Text> : null}
          {isPaused && openPause ? (
            <View style={[styles.chip, styles.outsidePill]}>
              <View style={[styles.chipDot, { backgroundColor: AMBER }]} />
              <Text style={[styles.chipLabel, { color: AMBER }]}>
                {`${pauseReason === "permission" ? "On permission" : "Outside"}: ${formatElapsed(outsideMs)}`}
              </Text>
            </View>
          ) : null}
          {/* Persists after returning in-range — today's total across every pause (open or closed). */}
          {totalOutsideMs > 0 ? (
            <Text style={styles.outsideTotal}>Outside today: {formatDuration(totalOutsideMs)}</Text>
          ) : null}
        </View>
      ) : null}

      {trackingWarning ? (
        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>Location sharing has stopped</Text>
          <Text style={styles.warningText}>{trackingWarning}</Text>
          <Button
            label="Fix now"
            size="sm"
            variant="solid"
            onPress={() => useTrackingFixStore.getState().show()}
            style={styles.warningButton}
          />
        </View>
      ) : null}

      {onEnableSharing ? (
        <Button
          label={enablingSharing ? "Starting…" : "Turn on live sharing"}
          icon={<Icon name="refresh" size={16} color={colors.panelHeroText} strokeWidth={2} />}
          size="sm"
          variant="secondary"
          onPress={onEnableSharing}
          disabled={enablingSharing}
          style={styles.enableButton}
          labelStyle={styles.enableLabel}
        />
      ) : null}

      {stats ? (
        <StatRow>
          <StatBox label="In at" value={stats.inAt} />
          <StatBox label="Mode" value={stats.mode} />
          <StatBox label="Range" value={stats.range} valueStyle={stats.rangeWarn ? styles.rangeWarn : undefined} />
        </StatRow>
      ) : null}

      <Button variant="solid" pulse label={checkedIn ? "Check out" : "Check in"} onPress={onPrimaryAction} />

      {actions.length > 0 ? (
        <View style={styles.tiles}>
          {tileRows.map((row, i) => (
            <QuickActions key={i} actions={row} />
          ))}
        </View>
      ) : null}
    </GlowPanel>
  );
}

function LegendItem({ swatch, label }: { swatch: object; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={swatch} />
      <Text style={styles.legendLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

// Amber readable on the dark panel (colors.warning is tuned for light surfaces).
const AMBER = "#FFC65A";
const AMBER_BG = "rgba(255,176,60,0.16)";

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 99,
    flexShrink: 1,
  },
  chipDot: { width: 7, height: 7, borderRadius: 4 },
  chipLabel: { fontSize: 12, fontWeight: "600", fontFamily: fontFamilies.semiBold },
  pingLabel: { fontSize: 12, fontFamily: fontFamilies.regular, color: colors.panelHeroMuted, fontVariant: ["tabular-nums"] },

  gaugeOuter: { alignSelf: "center" },
  gauge: { position: "absolute", width: GW, height: GH },
  needle: {
    position: "absolute",
    left: CX - (R + 14),
    top: CY - 14,
    width: 2 * (R + 14),
    height: 28,
  },
  needlePulse: { position: "absolute", left: 3, top: 3, width: 22, height: 22 },
  needleRing: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "rgba(255,160,70,0.7)",
  },
  needleDot: { position: "absolute", left: 6, top: 6, width: 16, height: 16, borderRadius: 8, backgroundColor: "#FFFFFF" },
  endLabel: {
    position: "absolute",
    top: 166,
    width: 60,
    textAlign: "center",
    fontSize: 11,
    fontFamily: fontFamilies.regular,
    color: colors.panelHeroMuted,
    fontVariant: ["tabular-nums"],
  },
  centre: { position: "absolute", left: 0, right: 0, top: 78, alignItems: "center", paddingHorizontal: 40 },
  centreKicker: { ...typography.kicker, color: colors.panelHeroMuted },
  timer: {
    ...typography.display,
    lineHeight: 48,
    marginTop: 4,
    color: colors.panelHeroText,
  },
  centreSub: { fontSize: 13, fontWeight: "500", fontFamily: fontFamilies.medium, color: colors.panelHeroMuted, marginTop: 2 },

  legend: { flexDirection: "row", justifyContent: "center", flexWrap: "wrap", columnGap: 18, rowGap: 6 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendLabel: { fontSize: 11, fontWeight: "500", fontFamily: fontFamilies.medium, color: "rgba(247,243,239,0.75)" },
  swWorked: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  swPermission: { width: 8, height: 8, borderRadius: 2, backgroundColor: "rgba(255,200,90,0.7)" },
  swRemaining: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.2)" },

  notes: { alignItems: "center", gap: 6 },
  caption: { ...typography.caption, fontSize: 12, lineHeight: 17, color: colors.panelHeroMuted, textAlign: "center" },
  outsidePill: { alignSelf: "center", backgroundColor: AMBER_BG, flexShrink: 0 },
  outsideTotal: { fontSize: 11.5, fontFamily: fontFamilies.regular, color: colors.panelHeroMuted },

  warningBox: { backgroundColor: colors.surface, borderRadius: radius.chip, padding: 12 },
  warningTitle: { ...typography.bodyStrong, fontSize: 14, color: colors.warning, marginBottom: 2 },
  warningText: { ...typography.caption, color: colors.textSecondary },
  warningButton: { alignSelf: "flex-start", marginTop: spacing.sm },
  enableButton: { alignSelf: "center", backgroundColor: colors.panelHeroChip, borderColor: colors.panelHeroLine },
  enableLabel: { color: colors.panelHeroText },
  rangeWarn: { color: "#FF8A80" },
  tiles: { gap: 8 },
});
