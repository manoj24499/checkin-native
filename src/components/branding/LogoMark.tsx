import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors } from "@/theme";

const WORDMARK = "INZIVO";

const GRID = 104; // source design's coordinate grid — all offsets below are in this space
const DURATION_MS = 1100; // "roughly one second of build" per the source design's own copy

interface LogoMarkProps {
  /**
   * Plays the one-shot build-in once on mount and holds its settled state.
   * false (default) renders the settled mark directly, no animation — use
   * for anything that isn't a genuine once-per-session moment.
   */
  animated?: boolean;
  size?: number;
  /** Bar color — pass colors.textOnDark on a dark panel (e.g. the login
   * hero), defaults to colors.textPrimary for light backgrounds. */
  barColor?: string;
}

/**
 * The Inzivo "Z-gate" mark: a top bar, a bottom bar, and an orange diagonal
 * stroke between them, wiped into view top-to-bottom. Imported from the
 * "Inzivo Z-gate — Animated" Claude Design project.
 *
 * Animation technique deliberately avoids animating SVG geometry (this
 * codebase has no precedent for it, and react-native-svg's clip-path
 * animation is a known-flaky combination on Fabric): bars are plain Views
 * animated via transform/opacity (native driver), and the diagonal wipe is
 * a plain View height reveal (`overflow: 'hidden'`) wrapping a static SVG
 * path — the same category of animation (Animated.Value + non-native-driver
 * layout property) already proven in SlideToConfirmTrack.tsx.
 */
export function LogoMark({ animated = false, size = 96, barColor = colors.textPrimary }: LogoMarkProps) {
  const unit = size / GRID;
  const progress = useRef(new Animated.Value(animated ? 0 : 1)).current;
  const wipeProgress = useRef(new Animated.Value(animated ? 0 : 1)).current;

  useEffect(() => {
    if (!animated) return;
    Animated.parallel([
      Animated.timing(progress, { toValue: 1, duration: DURATION_MS, useNativeDriver: true }),
      Animated.timing(wipeProgress, { toValue: 1, duration: DURATION_MS, useNativeDriver: false }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animated]);

  const topTranslateX = progress.interpolate({
    inputRange: [0, 0.25],
    outputRange: [-70 * unit, 0],
    extrapolate: "clamp",
  });
  const topOpacity = progress.interpolate({ inputRange: [0, 0.25], outputRange: [0, 1], extrapolate: "clamp" });

  const bottomTranslateX = progress.interpolate({
    inputRange: [0.35, 0.6],
    outputRange: [70 * unit, 0],
    extrapolate: "clamp",
  });
  const bottomOpacity = progress.interpolate({ inputRange: [0.35, 0.6], outputRange: [0, 1], extrapolate: "clamp" });

  const wipeHeight = wipeProgress.interpolate({
    inputRange: [0.2, 0.55],
    outputRange: [0, size],
    extrapolate: "clamp",
  });

  const wordOpacity = progress.interpolate({ inputRange: [0.6, 0.85], outputRange: [0, 1], extrapolate: "clamp" });
  const wordTranslateY = progress.interpolate({
    inputRange: [0.6, 0.85],
    outputRange: [9 * unit, 0],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.row}>
      <View style={{ width: size, height: size }}>
        <Animated.View
          style={[
            styles.bar,
            {
              left: 16 * unit,
              top: 16 * unit,
              width: 72 * unit,
              height: 14 * unit,
              backgroundColor: barColor,
              opacity: topOpacity,
              transform: [{ translateX: topTranslateX }],
            },
          ]}
        />
        <Animated.View style={[styles.wipe, { width: size, height: wipeHeight }]}>
          <Svg width={size} height={size} viewBox={`0 0 ${GRID} ${GRID}`} fill="none">
            <Path d="M88 16 L38 88 H16 L66 16 Z" fill={colors.primary} />
          </Svg>
        </Animated.View>
        <Animated.View
          style={[
            styles.bar,
            {
              left: 16 * unit,
              top: 74 * unit,
              width: 72 * unit,
              height: 14 * unit,
              backgroundColor: barColor,
              opacity: bottomOpacity,
              transform: [{ translateX: bottomTranslateX }],
            },
          ]}
        />
      </View>
      <Animated.Text
        style={[
          styles.word,
          {
            color: barColor,
            fontSize: size * 0.42,
            opacity: wordOpacity,
            transform: [{ translateY: wordTranslateY }],
          },
        ]}
      >
        {WORDMARK}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  bar: { position: "absolute" },
  wipe: { position: "absolute", top: 0, left: 0, overflow: "hidden" },
  word: { fontWeight: "800", letterSpacing: -0.5 },
});
