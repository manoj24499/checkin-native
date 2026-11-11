import { Animated, StyleSheet, type ViewStyle } from "react-native";
import { loopEasing, useLoop } from "./animation";
import { colors, motion } from "@/theme";

export interface PulseRingProps {
  /** Diameter of the element it sits behind. */
  size: number;
  /** Fill colour (variant "fill") or stroke colour ("ring"). Default colors.pulse (#FF8A2B). */
  color?: string;
  /** "fill": expanding solid disc (avatar / live dot). "ring": expanding 2px outline (profile avatar). */
  variant?: "fill" | "ring";
  /** Final scale. Default 2.6 for small dots; use ~1.35-1.6 for avatars so it stays subtle. */
  scaleTo?: number;
  /** Start opacity. Default 0.7. */
  opacityFrom?: number;
  /** Cycle in ms. Default 2400. */
  duration?: number;
  delay?: number;
  enabled?: boolean;
  style?: ViewStyle;
}

/**
 * The mockups' `pulse`/`livep` keyframe: a disc or ring behind an element that scales up and fades out on a
 * loop. Absolutely positioned at the parent's top-left with the given size — put it as the FIRST child of a
 * `position: relative` box the same size as the element. Static (hidden) under reduced motion.
 */
export function PulseRing({
  size,
  color = colors.pulse,
  variant = "fill",
  scaleTo = 2.6,
  opacityFrom = 0.7,
  duration = motion.pulseDuration,
  delay,
  enabled = true,
  style,
}: PulseRingProps) {
  const t = useLoop({ duration, delay, easing: loopEasing.easeOut, enabled, restValue: 1 });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.base,
        { width: size, height: size, borderRadius: size / 2 },
        variant === "fill" ? { backgroundColor: color } : { borderWidth: 2, borderColor: color },
        {
          opacity: t.interpolate({ inputRange: [0, 1], outputRange: [opacityFrom, 0] }),
          transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, scaleTo] }) }],
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: { position: "absolute", left: 0, top: 0 },
});
