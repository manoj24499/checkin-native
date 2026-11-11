import { memo, useMemo } from "react";
import { Animated, StyleSheet, View, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { useLoop } from "./animation";
import { colors } from "@/theme";

export type GlowCorner = "topLeft" | "topRight" | "bottomLeft" | "bottomRight";

export interface GlowSpec {
  /** Which corner the glow hugs (it overhangs the edge, like the mockups). */
  corner: GlowCorner;
  /** Circle diameter. Default 320. */
  size?: number;
  /** Centre colour (fades to transparent at 70%). Default colors.glowOrange. */
  color?: string;
  /** Centre opacity 0..1. Default 0.5 (orange) — the mockups use .25-.32 for the secondary peach glow. */
  opacity?: number;
  /** One full drift cycle in ms (mockup: 9-12s). Default 10000. */
  duration?: number;
  /** Drift the opposite way (CSS `animation-direction: reverse`). */
  reverse?: boolean;
  /** Override the default position offsets (px from the corner's two edges; negative = overhang). */
  x?: number;
  y?: number;
}

export type AmbientGlowPreset = "default" | "topLeft" | "topRight" | "login" | "corners" | "subtle";

const PRESETS: Record<AmbientGlowPreset, GlowSpec[]> = {
  // Home (Main.dc.html): big orange glow top-left + soft peach glow lower right.
  default: [
    { corner: "topLeft", size: 320, opacity: 0.5, duration: 9000 },
    { corner: "bottomRight", size: 300, color: colors.glowPeach, opacity: 0.25, duration: 11000, reverse: true },
  ],
  topLeft: [{ corner: "topLeft", size: 320, opacity: 0.45, duration: 10000 }],
  // Profile / Notifications style: one glow hanging off the top-right.
  topRight: [{ corner: "topRight", size: 320, opacity: 0.5, duration: 10000 }],
  // Login / Welcome: top-right orange + bottom-left peach.
  login: [
    { corner: "topRight", size: 320, opacity: 0.5, duration: 10000 },
    { corner: "bottomLeft", size: 340, color: colors.glowPeach, opacity: 0.32, duration: 12000, reverse: true },
  ],
  corners: [
    { corner: "topRight", size: 320, opacity: 0.45, duration: 10000 },
    { corner: "bottomLeft", size: 320, color: colors.glowPeach, opacity: 0.28, duration: 12000, reverse: true },
  ],
  // Forms / sheets: a faint single glow.
  subtle: [{ corner: "topRight", size: 300, opacity: 0.28, duration: 11000 }],
};

/** Default placement per corner (from the mockups, at 390pt width). */
const POSITION: Record<GlowCorner, { x: number; y: number }> = {
  topLeft: { x: -80, y: 60 },
  topRight: { x: -90, y: -20 },
  bottomLeft: { x: -110, y: -60 },
  bottomRight: { x: -100, y: 80 },
};

/** Drift amplitude (mockup float keyframe: translate(36px, 44px) at 50%). */
const DRIFT_X = 36;
const DRIFT_Y = 44;

let glowIdCounter = 0;

const GlowBlob = memo(function GlowBlob({ spec, intensity }: { spec: GlowSpec; intensity: number }) {
  const { corner, size = 320, color = colors.glowOrange, opacity = 0.5, duration = 10000, reverse } = spec;
  const id = useMemo(() => `ambientGlow${++glowIdCounter}`, []);
  const t = useLoop({ duration, pingPong: true });
  const pos = POSITION[corner];
  const x = spec.x ?? pos.x;
  const y = spec.y ?? pos.y;
  const sign = reverse ? -1 : 1;
  // Mirror the drift so glows on the right/bottom move inward like the left/top ones.
  const dirX = (corner === "topRight" || corner === "bottomRight" ? -1 : 1) * sign;
  const dirY = (corner === "bottomLeft" || corner === "bottomRight" ? -1 : 1) * sign;
  const o = Math.min(1, opacity * intensity);
  // The CSS uses blur(30px) on top of the radial fade, which spreads it; draw the SVG 20% bigger with a
  // softer falloff to match without a blur filter.
  const drawn = Math.round(size * 1.2);
  const offset = (drawn - size) / 2;

  const placement: ViewStyle = {
    position: "absolute",
    width: drawn,
    height: drawn,
    ...(corner === "topLeft" || corner === "bottomLeft" ? { left: x - offset } : { right: x - offset }),
    ...(corner === "topLeft" || corner === "topRight" ? { top: y - offset } : { bottom: y - offset }),
  };

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        placement,
        {
          transform: [
            { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, DRIFT_X * dirX] }) },
            { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, DRIFT_Y * dirY] }) },
          ],
        },
      ]}
    >
      <Svg width={drawn} height={drawn}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={o} />
            <Stop offset="0.3" stopColor={color} stopOpacity={o * 0.72} />
            <Stop offset="0.55" stopColor={color} stopOpacity={o * 0.3} />
            <Stop offset="0.78" stopColor={color} stopOpacity={o * 0.07} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={drawn / 2} cy={drawn / 2} r={drawn / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
});

export interface AmbientGlowProps {
  /** A named layout (default "default" = Home's top-left + bottom-right) or explicit glow specs. */
  preset?: AmbientGlowPreset;
  glows?: GlowSpec[];
  /** Opacity multiplier for every glow (0.5 = half as strong). Default 1. */
  intensity?: number;
  style?: ViewStyle;
}

/**
 * Animated ambient background: big soft orange radial glows hanging off the corners, slowly drifting
 * (9-12s ping-pong, native driver, stops under reduced motion). Absolutely fills its parent and ignores
 * touches. ScreenBackground/Screen render it automatically; use it directly only in custom layouts.
 */
export function AmbientGlow({ preset = "default", glows, intensity = 1, style }: AmbientGlowProps) {
  const list = glows ?? PRESETS[preset];
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip, style]}>
      {list.map((g, i) => (
        <GlowBlob key={`${g.corner}-${i}`} spec={g} intensity={intensity} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden" },
});
