import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, LayoutChangeEvent, PanResponder, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors, radius, spacing, typography } from "@/theme";

const KNOB_WIDTH = 54;
const KNOB_HEIGHT = 52;
const TRACK_PADDING = 4;
const TRACK_HEIGHT = 62;
const CONFIRM_THRESHOLD = 0.9;

interface SlideToConfirmTrackProps {
  title: string;
  kicker: string;
  helpText?: string;
  disabled?: boolean;
  onConfirm: () => void;
}

/**
 * Slide-to-confirm — the primary check-in/out action. Deliberately
 * un-mistappable: dragging the knob past 90% of the track triggers
 * onConfirm; anything short of that snaps back to the start. Uses the
 * built-in PanResponder + Animated APIs (same approach as the ring this
 * replaced) — no extra dependency beyond react-native-svg.
 */
export function SlideToConfirmTrack({ title, kicker, helpText, disabled, onConfirm }: SlideToConfirmTrackProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [frac, setFrac] = useState(0);
  const dragX = useRef(new Animated.Value(0)).current;
  const dragXValueRef = useRef(0);
  const dragStartRef = useRef(0);

  const maxDrag = Math.max(40, trackWidth - KNOB_WIDTH - TRACK_PADDING * 2);

  // PanResponder.create runs once (inside the useRef below) — its handlers
  // must read these through refs, not close over them directly, or they'd
  // stay stuck on whatever disabled/maxDrag/onConfirm were at mount time.
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const maxDragRef = useRef(maxDrag);
  maxDragRef.current = maxDrag;
  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;

  useEffect(() => {
    const id = dragX.addListener(({ value }) => {
      dragXValueRef.current = value;
      setFrac(maxDrag > 0 ? Math.max(0, Math.min(1, value / maxDrag)) : 0);
    });
    return () => dragX.removeListener(id);
  }, [dragX, maxDrag]);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  }, []);

  const snapTo = useCallback(
    (value: number) => {
      Animated.timing(dragX, { toValue: value, duration: 180, useNativeDriver: false }).start();
    },
    [dragX],
  );

  // Once whatever was blocking submission (or the pending request itself)
  // clears, snap back to the start — matters most after a failed submit,
  // where the knob is sitting at the far end.
  const prevDisabledRef = useRef(disabled);
  useEffect(() => {
    if (prevDisabledRef.current && !disabled) snapTo(0);
    prevDisabledRef.current = disabled;
  }, [disabled, snapTo]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabledRef.current,
      onMoveShouldSetPanResponder: () => !disabledRef.current,
      onPanResponderGrant: () => {
        dragStartRef.current = dragXValueRef.current;
        setDragging(true);
      },
      onPanResponderMove: (_evt, gesture) => {
        const max = maxDragRef.current;
        const next = Math.max(0, Math.min(max, dragStartRef.current + gesture.dx));
        dragX.setValue(next);
      },
      onPanResponderRelease: () => {
        setDragging(false);
        const max = maxDragRef.current;
        if (dragXValueRef.current >= max * CONFIRM_THRESHOLD) {
          Animated.timing(dragX, { toValue: max, duration: 120, useNativeDriver: false }).start();
          onConfirmRef.current();
        } else {
          Animated.timing(dragX, { toValue: 0, duration: 180, useNativeDriver: false }).start();
        }
      },
    }),
  ).current;

  const enabled = !disabled;
  const labelOpacity = Math.max(0, 1 - frac * 1.6);
  const hint = !enabled ? "" : frac >= CONFIRM_THRESHOLD ? "release to confirm" : "slide right";
  const fillWidth = Animated.add(dragX, new Animated.Value(TRACK_PADDING + KNOB_WIDTH));

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={[styles.kicker, { color: enabled ? colors.primary : colors.textMuted }]}>{kicker}</Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>

      <View
        onLayout={handleLayout}
        style={[styles.track, enabled ? styles.trackEnabled : styles.trackDisabled]}
      >
        <Animated.View style={[styles.fill, { width: fillWidth }]} />
        <View style={styles.labelWrap} pointerEvents="none">
          <Text
            style={[
              styles.title,
              { color: enabled ? colors.textPrimary : colors.textMuted, opacity: labelOpacity },
            ]}
          >
            {title}
          </Text>
        </View>
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.knob,
            { left: dragX },
            enabled ? styles.knobEnabled : styles.knobDisabled,
            dragging && styles.knobDragging,
          ]}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M5 12h13"
              stroke={enabled ? colors.primaryText : colors.textMuted}
              strokeWidth={2}
              strokeLinecap="round"
            />
            <Path
              d="m12 5 7 7-7 7"
              stroke={enabled ? colors.primaryText : colors.textMuted}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Animated.View>
      </View>

      {helpText ? <Text style={styles.help}>{helpText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%" },
  headerRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  kicker: { ...typography.label, letterSpacing: 1.5 },
  hint: { fontSize: 10, color: colors.textMuted },
  track: {
    position: "relative",
    height: TRACK_HEIGHT,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  trackEnabled: { backgroundColor: colors.surface, borderColor: "rgba(240,100,0,0.45)" },
  trackDisabled: { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
  fill: { position: "absolute", top: 0, bottom: 0, left: 0, backgroundColor: "rgba(240,100,0,0.10)" },
  labelWrap: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...typography.bodyStrong },
  knob: {
    position: "absolute",
    top: TRACK_PADDING,
    width: KNOB_WIDTH,
    height: KNOB_HEIGHT,
    borderRadius: radius.sm + 1,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  knobEnabled: { backgroundColor: colors.primary, borderColor: colors.primary },
  knobDisabled: { backgroundColor: colors.surface, borderColor: colors.border },
  knobDragging: { shadowColor: colors.primary, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4 },
  help: { ...typography.body, color: colors.textSecondary, marginTop: spacing.md },
});
