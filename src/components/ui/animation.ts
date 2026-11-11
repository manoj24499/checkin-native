import { useEffect, useRef } from "react";
import { Animated, Easing, type EasingFunction } from "react-native";
import { useReducedMotion } from "./useReducedMotion";

const SINE_IN_OUT = Easing.inOut(Easing.sin);
/** Stable easings to pass to useLoop (an inline `Easing.x(...)` would restart the loop on every render). */
export const loopEasing = {
  sineInOut: SINE_IN_OUT,
  easeOut: Easing.out(Easing.ease),
  linear: Easing.linear,
} as const;

interface LoopOptions {
  /** Full cycle length in ms. */
  duration: number;
  /** true: 0 -> 1 -> 0 (ping-pong, like CSS `ease-in-out infinite` keyframes 0/50/100%). false: 0 -> 1, jump back. */
  pingPong?: boolean;
  /** Delay before the first cycle (ms). */
  delay?: number;
  /** Must be a stable reference (module constant / `loopEasing.*`). Default sine in-out. */
  easing?: EasingFunction;
  /** Set false to stop (value parks at `restValue`). Reduced motion always stops it. */
  enabled?: boolean;
  /** Where the value sits when stopped. Default 0. */
  restValue?: number;
}

/**
 * Looping 0..1 Animated.Value on the native driver — the building block for glows, pulses, the breathe ring
 * and button shimmer. Honours reduced motion (returns a static value).
 */
export function useLoop({
  duration,
  pingPong = false,
  delay = 0,
  easing = SINE_IN_OUT,
  enabled = true,
  restValue = 0,
}: LoopOptions) {
  const reduced = useReducedMotion();
  const value = useRef(new Animated.Value(restValue)).current;
  const run = enabled && !reduced;
  useEffect(() => {
    if (!run) {
      value.setValue(restValue);
      return;
    }
    value.setValue(0);
    const step = pingPong
      ? Animated.sequence([
          Animated.timing(value, { toValue: 1, duration: duration / 2, easing, useNativeDriver: true }),
          Animated.timing(value, { toValue: 0, duration: duration / 2, easing, useNativeDriver: true }),
        ])
      : Animated.timing(value, { toValue: 1, duration, easing, useNativeDriver: true });
    const loop = Animated.loop(step, { resetBeforeIteration: true });
    const timer = setTimeout(() => loop.start(), delay);
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, [run, duration, pingPong, delay, easing, restValue, value]);
  return value;
}
