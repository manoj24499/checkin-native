import { PropsWithChildren } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { AmbientGlow, type AmbientGlowPreset, type GlowSpec } from "./AmbientGlow";
import { colors } from "@/theme";

export interface ScreenBackgroundProps extends PropsWithChildren {
  /**
   * "gradient" (default; legacy name) or "glow": warm off-white page with animated ambient orange glows.
   * "plain": flat page colour, no glows (focused forms, camera flows).
   */
  variant?: "gradient" | "glow" | "plain";
  /** Which glow layout to draw (AmbientGlow preset). Default "default" (top-left + bottom-right). */
  glow?: AmbientGlowPreset;
  /** Explicit glow specs (overrides `glow`). */
  glows?: GlowSpec[];
  /** Glow opacity multiplier. Default 1. */
  glowIntensity?: number;
  style?: ViewStyle;
}

/**
 * Full-bleed screen backdrop: flat `colors.background` (#F7F5F2) plus the drifting AmbientGlow layer.
 * `Screen` already wraps its content in this; use it directly only for screens that don't use `Screen`.
 */
export function ScreenBackground({
  variant = "gradient",
  glow = "default",
  glows,
  glowIntensity = 1,
  style,
  children,
}: ScreenBackgroundProps) {
  return (
    <View style={[styles.fill, style]}>
      {variant !== "plain" ? <AmbientGlow preset={glow} glows={glows} intensity={glowIntensity} /> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
});
