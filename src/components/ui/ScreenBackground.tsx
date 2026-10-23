import { PropsWithChildren } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, gradients } from "@/theme";

interface ScreenBackgroundProps extends PropsWithChildren {
  /** "gradient" (default) draws the lime fade behind the top ~46% of the
   * screen; "plain" is just the flat pale background. */
  variant?: "gradient" | "plain";
  style?: ViewStyle;
}

/**
 * Full-bleed screen backdrop: flat `colors.background` with the Lime theme's
 * soft lime gradient fading in from the top. `Screen` already wraps its
 * content in this; use it directly only for screens that don't use `Screen`
 * (custom layouts, the login screen).
 */
export function ScreenBackground({ variant = "gradient", style, children }: ScreenBackgroundProps) {
  return (
    <View style={[styles.fill, style]}>
      {variant === "gradient" ? (
        <LinearGradient
          pointerEvents="none"
          colors={gradients.screen}
          locations={gradients.screenLocations}
          style={styles.gradient}
        />
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  gradient: { position: "absolute", top: 0, left: 0, right: 0, height: "46%" },
});
