import { PropsWithChildren } from "react";
import { RefreshControl, ScrollView, StyleSheet, View, ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { ScreenBackground } from "./ScreenBackground";
import { useTabBarClearance } from "@/navigation/tabBarClearance";
import { colors, spacing } from "@/theme";

interface ScreenProps extends PropsWithChildren {
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: ViewStyle;
  /** "gradient" (default): lime fade behind the top of the screen.
   * "plain": flat pale background (modals, focused forms). */
  background?: "gradient" | "plain";
  /** Safe-area edges to pad. Default ["top", "bottom"]. */
  edges?: Edge[];
  /** Add bottom room for the floating tab bar when inside the tabs. Default true; pass false when an inner
   * scroller pads itself (Dashboard). */
  tabBarClearance?: boolean;
}

/**
 * Standard screen shell: ScreenBackground (lime fade) + SafeAreaView +
 * optional ScrollView with pull-to-refresh. Content gets 16px padding.
 */
export function Screen({
  children,
  scroll = false,
  refreshing,
  onRefresh,
  contentStyle,
  background = "gradient",
  edges = ["top", "bottom"],
  tabBarClearance = true,
}: ScreenProps) {
  const clearance = useTabBarClearance();
  const bottomRoom = tabBarClearance && clearance ? { paddingBottom: spacing.md + clearance } : null;
  if (scroll) {
    return (
      <ScreenBackground variant={background}>
        <SafeAreaView style={styles.safeArea} edges={edges}>
          <ScrollView
            contentContainerStyle={[styles.content, bottomRoom, contentStyle]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={!!refreshing}
                  onRefresh={onRefresh}
                  tintColor={colors.ink}
                  colors={[colors.ink]}
                  progressBackgroundColor={colors.lime}
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
    <ScreenBackground variant={background}>
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
