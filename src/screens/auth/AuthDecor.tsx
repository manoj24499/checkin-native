import { Animated, Easing, StyleSheet, View, useWindowDimensions } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useLoop } from "@/components/ui";

const LINEAR = Easing.linear;

/** One scrolling wave band: 2x screen wide, slides left by one screen width per cycle (seamless). */
function Wave({ bottom, duration, d, fill }: { bottom: number; duration: number; d: string; fill: string }) {
  const { width } = useWindowDimensions();
  const t = useLoop({ duration, easing: LINEAR });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: 0,
        bottom,
        width: width * 2,
        height: 160,
        transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, -width] }) }],
      }}
    >
      <Svg width={width * 2} height={160} viewBox="0 0 780 160" preserveAspectRatio="none">
        <Path d={d} fill={fill} />
      </Svg>
    </Animated.View>
  );
}

/** Login.dc.html: three translucent orange wave layers drifting left at 14s / 9s / 6s. */
export function WaveLayers() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Wave bottom={60} duration={14000} d="M0 80 Q97.5 30 195 80 T390 80 T585 80 T780 80 V160 H0Z" fill="rgba(239,108,0,0.10)" />
      <Wave bottom={20} duration={9000} d="M0 90 Q97.5 50 195 90 T390 90 T585 90 T780 90 V160 H0Z" fill="rgba(239,108,0,0.14)" />
      <Wave bottom={-30} duration={6000} d="M0 100 Q97.5 70 195 100 T390 100 T585 100 T780 100 V160 H0Z" fill="rgba(239,108,0,0.18)" />
    </View>
  );
}

/** Breathing outline ring (`ringb`: scale .85 <-> 1.15, opacity .55 <-> .15, 5s). */
function BreathRing({ left, top, size, color, delay }: { left: number; top: number; size: number; color: string; delay?: number }) {
  const t = useLoop({ duration: 5000, pingPong: true, delay, restValue: 0.5 });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left,
        top,
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: color,
        opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.15] }),
        transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] }) }],
      }}
    />
  );
}

/** Login.dc.html: two concentric rings breathing off the left edge. */
export function BreathRings({ top = 300 }: { top?: number }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <BreathRing left={-70} top={top} size={200} color="rgba(239,108,0,0.35)" />
      <BreathRing left={-40} top={top + 30} size={140} color="rgba(239,108,0,0.30)" delay={1200} />
    </View>
  );
}
