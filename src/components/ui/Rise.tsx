import { PropsWithChildren, useEffect, useRef } from "react";
import { Animated, type StyleProp, type ViewStyle } from "react-native";
import { useReducedMotion } from "./useReducedMotion";
import { motion } from "@/theme";

export interface RiseProps extends PropsWithChildren {
  /** Start delay in ms (stagger cards by ~100: 0, 100, 250, 350…). Default 0. */
  delay?: number;
  /** Rise distance in px. Default 26. */
  distance?: number;
  /** Duration in ms. Default 800. */
  duration?: number;
  /** Skip the animation (render in place). */
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Entrance animation from the mockups' `.rise` class: fade 0 -> 1 while sliding up 26px, 0.8s
 * cubic-bezier(.2,.8,.2,1), once on mount (native driver). Wrap each card/section and stagger `delay`.
 * Under reduced motion it renders statically.
 */
export function Rise({
  delay = 0,
  distance = motion.riseDistance,
  duration = motion.riseDuration,
  disabled,
  style,
  children,
}: RiseProps) {
  const reduced = useReducedMotion();
  const skip = disabled || reduced;
  const progress = useRef(new Animated.Value(skip ? 1 : 0)).current;

  useEffect(() => {
    if (skip) {
      progress.setValue(1);
      return;
    }
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      easing: motion.riseEasing,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
    // Entrance only: re-running on prop changes would replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
