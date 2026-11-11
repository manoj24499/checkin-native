import { PropsWithChildren } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { colors, radius } from "@/theme";

export interface GlowPanelProps extends PropsWithChildren {
  /** Layout overrides (padding/gap/radius). */
  style?: StyleProp<ViewStyle>;
  /**
   * Apply the hero shape: radius 28, padding 18, gap 16 (Main.dc.html's presence panel). Off by default
   * because some callers draw only some corners rounded (the auth header panel).
   */
  rounded?: boolean;
}

/**
 * The dark "presence" panel: flat #2E1B10 with a 1px orange hairline (rgba(239,108,0,.42)). Text on it uses
 * colors.panelHeroText / panelHeroMuted; inner chips use colors.panelHeroChip (see StatBox tone "hero",
 * ActionTile). Pass `rounded` for the standard hero shape, or radius/padding via `style`.
 */
export function GlowPanel({ children, style, rounded }: GlowPanelProps) {
  return <View style={[styles.base, rounded && styles.rounded, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.panelHero,
    borderWidth: 1,
    borderColor: colors.panelHeroEdge,
    overflow: "hidden",
  },
  rounded: { borderRadius: radius.hero, padding: 18, gap: 16 },
});
