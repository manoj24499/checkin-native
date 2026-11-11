import { PropsWithChildren } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { gradientDirection, gradients } from "@/theme";

export interface GradientFillProps extends PropsWithChildren {
  /** Stops. Default the brand orange (#FFA64D -> #EF6C00). */
  colors?: readonly [string, string, ...string[]];
  /** Direction. Default "diagonal" (CSS 135deg). */
  direction?: keyof typeof gradientDirection;
  /** Size/radius/padding/layout of the box. The gradient is clipped to its radius. */
  style?: StyleProp<ViewStyle>;
}

/**
 * A View filled with the brand orange gradient (135deg) — logo tiles, the active segment/filter chip, the "on"
 * toggle track, progress fills. Children render on top; use colors.onOrange for text/glyphs on it.
 */
export function GradientFill({ colors = gradients.orange, direction = "diagonal", style, children }: GradientFillProps) {
  const dir = gradientDirection[direction];
  return (
    <View style={[styles.base, style]}>
      <LinearGradient pointerEvents="none" colors={colors} start={dir.start} end={dir.end} style={StyleSheet.absoluteFill} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { overflow: "hidden" },
});
