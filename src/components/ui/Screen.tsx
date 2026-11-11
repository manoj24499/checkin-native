import { PropsWithChildren } from "react";
import { RefreshControl, ScrollView, StyleSheet, View, ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { ScreenBackground } from "./ScreenBackground";
import type { AmbientGlowPreset, GlowSpec } from "./AmbientGlow";
import { useTabBarClearance } from "@/navigation/tabBarClearance";
import { colors, spacing } from "@/theme";

interface ScreenProps extends PropsWithChildren {
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: ViewStyle;
  /** "gradient" (default; legacy name) / "glow": page colour + drifting ambient glows.
   * "plain": flat page colour (modals, focused forms, camera). */
  background?: "gradient" | "glow" | "plain";
  /** Glow layout (AmbientGlow preset). Default "default". */
  glow?: AmbientGlowPreset;
  /** Explicit glow specs (overrides `glow`). */
  glows?: GlowSpec[];
  /** Glow opacity multiplier. Default 1. */
  glowIntensity?: number;
  /** Safe-area edges to pad. Default ["top", "bottom"]. */
  edges?: Edge[];
  /** Add bottom room for the floating tab bar when inside the tabs. Default true; pass false when an inner
   * scroller pads itself (Dashboard). */
  tabBarClearance?: boolean;
}

/**
 * Standard screen shell: ScreenBackground (page colour + ambient glows) + SafeAreaView + optional
 * ScrollView with pull-to-refresh. Content gets 16px padding (mockups use a 20px gutter: pass
 * `contentStyle={{ paddingHorizontal: spacing.gutter }}` when porting).
 */
export function Screen({
  children,
  scroll = false,
  refreshing,
  onRefresh,
  contentStyle,
  background = "gradient",
  glow,
  glows,
  glowIntensity,
  edges = ["top", "bottom"],
  tabBarClearance = true,
}: ScreenProps) {
  const clearance = useTabBarClearance();
  const bottomRoom = tabBarClearance && clearance ? { paddingBottom: spacing.md + clearance } : null;
  const bg = { variant: background, glow, glows, glowIntensity };
  if (scroll) {
    return (
      <ScreenBackground {...bg}>
        <SafeAreaView style={styles.safeArea} edges={edges}>
          <ScrollView
            contentContainerStyle={[styles.content, bottomRoom, contentStyle]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={!!refreshing}
                  onRefresh={onRefresh}
                  tintColor={colors.primary}
                  colors={[colors.primary]}
                  progressBackgroundColor={colors.surface}
                />
              ) : undefined
            }
          >
            {children}
          </ScrollView>
        </SafeAreaView>
      </ScreenBackground>
    );
  }
  return (
    <ScreenBackground {...bg}>
      <SafeAreaView style={styles.safeArea} edges={edges}>
        <View style={[styles.content, bottomRoom, contentStyle]}>{children}</View>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "transparent" },
  content: { flexGrow: 1, padding: spacing.md },
});
