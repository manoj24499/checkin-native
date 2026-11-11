import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useReducedMotion } from "./useReducedMotion";
import { colors, gradientDirection, gradients } from "@/theme";

interface ToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
}

const TRACK_W = 46;
const KNOB = 20;
const PAD = 3;
const TRAVEL = TRACK_W - KNOB - PAD * 2;
const EASE = Easing.bezier(0.3, 0.7, 0.2, 1);

/** Profile.dc.html switch: 46x26; on = orange gradient track, off = rgba(23,19,15,.14); white knob slides. */
export function Toggle({ value, onValueChange, disabled, accessibilityLabel }: ToggleProps) {
  const reduced = useReducedMotion();
  const x = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) {
      x.setValue(value ? 1 : 0);
      return;
    }
    const anim = Animated.timing(x, { toValue: value ? 1 : 0, duration: 260, easing: EASE, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [value, reduced, x]);

  return (
    <Pressable
      onPress={() => !disabled && onValueChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      hitSlop={6}
      style={[styles.track, disabled && styles.disabled]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: x }]}>
        <LinearGradient
          colors={gradients.orange}
          start={gradientDirection.diagonal.start}
          end={gradientDirection.diagonal.end}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View
        style={[styles.knob, { transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [0, TRAVEL] }) }] }]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_W,
    height: 26,
    borderRadius: 13,
    padding: PAD,
    justifyContent: "center",
    backgroundColor: "rgba(23,19,15,0.14)",
    overflow: "hidden",
  },
  knob: { width: KNOB, height: KNOB, borderRadius: KNOB / 2, backgroundColor: "#FFFFFF" },
  disabled: { opacity: 0.5 },
});
