import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, LayoutChangeEvent, PanResponder, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Icon, loopEasing, useLoop, useReducedMotion } from "@/components/ui";
import { colors, fontFamilies, gradientDirection, gradients, spacing, typography } from "@/theme";

const KNOB_SIZE = 50;
const KNOB_INSET = 4;
const TRACK_BORDER = 1;
const TRACK_HEIGHT = 60;
const CONFIRM_THRESHOLD = 0.9;
/** How far a locked knob can be tugged before it springs back (mockup: 30px). */
const LOCKED_TUG = 30;

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
 * built-in PanResponder + Animated APIs — no extra dependency.
 *
 * Look (CheckIn.dc.html): kicker above; a 60-high orange-tinted pill track whose fill follows the knob; the
 * label fades out as you drag, with a nudging chevron; the 50px knob is the orange gradient when unlocked and
 * grey when locked. Tugging a locked knob lets it move a little, then springs back and shakes the track.
 */
export function SlideToConfirmTrack({ title, kicker, helpText, disabled, onConfirm }: SlideToConfirmTrackProps) {
  const reduced = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragX = useRef(new Animated.Value(0)).current;
  const dragXValueRef = useRef(0);
  const dragStartRef = useRef(0);
  const shake = useRef(new Animated.Value(0)).current;

  const maxDrag = Math.max(40, trackWidth - TRACK_BORDER * 2 - KNOB_INSET * 2 - KNOB_SIZE);

  // PanResponder.create runs once (inside the useRef below) — its handlers
  // must read these through refs, not close over them directly, or they'd
  // stay stuck on whatever disabled/maxDrag/onConfirm were at mount time.
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const maxDragRef = useRef(maxDrag);
  maxDragRef.current = maxDrag;
  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;
  const reducedRef = useRef(reduced);
  reducedRef.current = reduced;
  // Whether the current drag started while locked (a "tug" that can only nudge).
  const tugRef = useRef(false);

  useEffect(() => {
    const id = dragX.addListener(({ value }) => {
      dragXValueRef.current = value;
    });
    return () => dragX.removeListener(id);
  }, [dragX]);

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

  const runShake = () => {
    if (reducedRef.current) return;
    shake.setValue(0);
    Animated.timing(shake, { toValue: 1, duration: 450, useNativeDriver: true }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      // Locked: only a knob resting at the start can be tugged (never one parked at the end while a request
      // is in flight).
      onStartShouldSetPanResponder: () => !disabledRef.current || dragXValueRef.current < 1,
      onMoveShouldSetPanResponder: () => !disabledRef.current || dragXValueRef.current < 1,
      onPanResponderGrant: () => {
        tugRef.current = !!disabledRef.current;
        dragStartRef.current = dragXValueRef.current;
        setDragging(true);
      },
      onPanResponderMove: (_evt, gesture) => {
        const max = tugRef.current ? LOCKED_TUG : maxDragRef.current;
        const next = Math.max(0, Math.min(max, dragStartRef.current + gesture.dx));
        dragX.setValue(next);
      },
      onPanResponderRelease: () => {
        setDragging(false);
        const max = maxDragRef.current;
        if (tugRef.current || disabledRef.current) {
          const moved = dragXValueRef.current > 5;
          Animated.timing(dragX, { toValue: 0, duration: 350, useNativeDriver: false }).start();
          if (moved) runShake();
          return;
        }
        if (dragXValueRef.current >= max * CONFIRM_THRESHOLD) {
          Animated.timing(dragX, { toValue: max, duration: 120, useNativeDriver: false }).start();
          onConfirmRef.current();
        } else {
          Animated.timing(dragX, { toValue: 0, duration: 350, useNativeDriver: false }).start();
        }
      },
      onPanResponderTerminate: () => {
        setDragging(false);
        Animated.timing(dragX, { toValue: 0, duration: 350, useNativeDriver: false }).start();
      },
    }),
  ).current;

  const enabled = !disabled;
  const { labelOpacity, fillWidth, knobLeft } = useMemo(
    () => ({
      labelOpacity: dragX.interpolate({ inputRange: [0, 140], outputRange: [1, 0], extrapolate: "clamp" }),
      fillWidth: Animated.add(dragX, new Animated.Value(KNOB_INSET + KNOB_SIZE)),
      knobLeft: Animated.add(dragX, new Animated.Value(KNOB_INSET)),
    }),
    [dragX],
  );
  const chev = useLoop({ duration: 1200, pingPong: true, easing: loopEasing.sineInOut });
  const shakeX = shake.interpolate({
    inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1],
    outputRange: [0, -8, 8, -5, 5, 0],
  });

  return (
    <View style={styles.wrap}>
      <Text style={styles.kicker}>{kicker}</Text>
      <Animated.View style={{ transform: [{ translateX: shakeX }] }}>
        <View
          onLayout={handleLayout}
          style={styles.track}
          accessibilityRole="adjustable"
          accessibilityLabel={title}
          accessibilityState={{ disabled: !enabled }}
        >
          <Animated.View style={[styles.fill, { width: fillWidth }]} />
          <Animated.View style={[styles.labelWrap, { opacity: labelOpacity }]} pointerEvents="none">
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Animated.View
              style={{
                opacity: chev.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
                transform: [{ translateX: chev.interpolate({ inputRange: [0, 1], outputRange: [0, 5] }) }],
              }}
            >
              <Icon name="chevronRight" size={16} color={colors.accentText} strokeWidth={2.4} />
            </Animated.View>
          </Animated.View>
          <Animated.View
            {...panResponder.panHandlers}
            style={[styles.knob, { left: knobLeft }, dragging && enabled && styles.knobDragging]}
          >
            {enabled ? (
              <LinearGradient
                colors={gradients.orange}
                {...gradientDirection.diagonal}
                style={StyleSheet.absoluteFill}
              />
            ) : null}
            <Icon name="arrow" size={20} color={enabled ? colors.onOrange : "#FFFFFF"} strokeWidth={2.4} />
          </Animated.View>
        </View>
      </Animated.View>

      {helpText ? <Text style={styles.help}>{helpText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%" },
  kicker: { ...typography.kicker, color: colors.kicker, marginTop: 2, marginBottom: spacing.sm, marginLeft: 4 },
  track: {
    position: "relative",
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    borderWidth: TRACK_BORDER,
    borderColor: "rgba(239,108,0,0.28)",
    backgroundColor: "rgba(239,108,0,0.12)",
    overflow: "hidden",
  },
  fill: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(239,108,0,0.25)",
  },
  labelWrap: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    paddingLeft: 40,
    paddingRight: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  title: { fontFamily: fontFamilies.semiBold, fontWeight: "600", fontSize: 15, color: colors.accentText, flexShrink: 1 },
  knob: {
    position: "absolute",
    top: KNOB_INSET,
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    overflow: "hidden",
    backgroundColor: "#B9B1A8",
    alignItems: "center",
    justifyContent: "center",
  },
  knobDragging: { shadowColor: colors.primary, shadowOpacity: 0.45, shadowRadius: 12, elevation: 4 },
  help: { fontSize: 12, lineHeight: 17, textAlign: "center", color: colors.textSecondary, marginTop: spacing.sm, marginHorizontal: 4 },
});
