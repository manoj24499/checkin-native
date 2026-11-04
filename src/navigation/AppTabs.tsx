import { useEffect, useState } from "react";
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { createBottomTabNavigator, type BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { getFocusedRouteNameFromRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { DashboardNavigator } from "./DashboardNavigator";
import { MapTabScreen } from "./MapTabScreen";
import { CheckInOutScreen } from "@/screens/checkin/CheckInOutScreen";
import { RequestsScreen } from "@/screens/requests/RequestsScreen";
import { ProfileNavigator } from "./ProfileNavigator";
import { Icon, type IconName } from "@/components/ui";
import { useLeaveRequests } from "@/hooks";
import { colors, shadows } from "@/theme";
import type { AppTabParamList } from "./types";

const Tab = createBottomTabNavigator<AppTabParamList>();

const ICON_SIZE = 21;
const ICON_STROKE_WIDTH = 1.75;
const BAR_HEIGHT = 66;

// Full-screen flows where the bar would only get in the way (mockup: no tab
// bar on turn-by-turn navigation).
const HIDE_BAR_ON: string[] = ["Navigate"];

type TabRouteName = keyof AppTabParamList;

const TAB_ICONS: Record<TabRouteName, IconName> = {
  CheckIn: "check",
  Dashboard: "home",
  Map: "pin",
  Requests: "requests",
  Profile: "profile",
};

function useAndroidKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const show = Keyboard.addListener("keyboardDidShow", () => setVisible(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

/** Replaces the old History tab slot — Leave/Permission/Overtime live here
 * now (see RequestsScreen). Calls its own hook for the pending-leave dot
 * since it's a real function component, not a plain render callback. */
function RequestsIcon({ color }: { color: string }) {
  const query = useLeaveRequests();
  const hasPending = (query.data?.requests ?? []).some((r) => r.status === "PENDING");
  return (
    <View>
      <Icon name="requests" size={ICON_SIZE} color={color} strokeWidth={ICON_STROKE_WIDTH} />
      {hasPending ? <View style={styles.pendingDot} /> : null}
    </View>
  );
}

/**
 * Floating "liquid glass" tab bar: a blurred, translucent pill hovering above the screens with a soft
 * specular highlight along its top edge. The active tab expands into an orange pill showing its label; the
 * rest are icon-only. It is absolutely positioned (screens scroll underneath it), so screens add
 * `useTabBarClearance()` of bottom padding. Tab press/long-press events are emitted exactly like the stock
 * bar, so nested stacks still pop-to-top when their tab is re-pressed.
 */
function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const keyboardVisible = useAndroidKeyboardVisible();
  const focusedRoute = state.routes[state.index];
  const nestedName = getFocusedRouteNameFromRoute(focusedRoute);
  if (nestedName && HIDE_BAR_ON.includes(nestedName)) return null;
  // On Android the window resizes for the keyboard, which would park the bar right above the keys and
  // squeeze forms like the check-in PIN. Same effect as the stock bar's tabBarHideOnKeyboard.
  if (keyboardVisible) return null;

  // Same contract as the stock tab bar: emit tabPress (lets a focused nested stack pop to top), then
  // navigate unless already focused or prevented.
  const pressTab = (key: string, name: string, params: object | undefined, focused: boolean) => {
    const event = navigation.emit({ type: "tabPress", target: key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) navigation.navigate(name, params);
  };

  return (
    <View pointerEvents="box-none" style={[styles.outer, { paddingBottom: Math.max(insets.bottom, 10) + 4 }]}>
      <View style={styles.bar}>
        <BlurView intensity={60} tint="dark" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.tint]} />
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(255,255,255,0.22)", "rgba(255,255,255,0.03)", "rgba(255,255,255,0.08)"]}
          locations={[0, 0.55, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View pointerEvents="none" style={styles.edgeLight} />
        <View style={styles.row}>
          {state.routes.map((route, index) => {
            const name = route.name as TabRouteName;
            const { options } = descriptors[route.key];
            const focused = state.index === index;
            const label = options.title ?? route.name;
            const color = focused ? colors.onAccent : "rgba(255,255,255,0.78)";
            return (
              <Pressable
                key={route.key}
                onPress={() => pressTab(route.key, route.name, route.params, focused)}
                onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
                style={[styles.slot, { flex: focused ? 2.15 : 1 }]}
              >
                <View style={[styles.item, focused ? styles.itemActive : styles.itemIdle]}>
                  {name === "Requests" ? (
                    <RequestsIcon color={color} />
                  ) : (
                    <Icon name={TAB_ICONS[name]} size={ICON_SIZE} color={color} strokeWidth={ICON_STROKE_WIDTH} />
                  )}
                  {focused ? (
                    <Text style={styles.label} numberOfLines={1}>
                      {label}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export function AppTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardNavigator} options={{ title: "Home" }} />
      <Tab.Screen name="Map" component={MapTabScreen} options={{ title: "Map" }} />
      <Tab.Screen name="CheckIn" component={CheckInOutScreen} options={{ title: "Check In/Out" }} />
      <Tab.Screen name="Requests" component={RequestsScreen} />
      <Tab.Screen name="Profile" component={ProfileNavigator} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  outer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 16 },
  bar: {
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(20,20,20,0.55)",
    ...shadows.tabBar,
  },
  tint: { backgroundColor: "rgba(34,34,34,0.38)" },
  // Thin bright line along the top edge: the "glass catches the light" cue.
  edgeLight: { position: "absolute", top: 0, left: 22, right: 22, height: 1, backgroundColor: "rgba(255,255,255,0.4)" },
  row: { flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 8 },
  slot: { alignItems: "center", justifyContent: "center" },
  item: { height: 48, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  itemIdle: { width: 48, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.07)" },
  itemActive: {
    alignSelf: "stretch",
    marginHorizontal: 2,
    borderRadius: 24,
    backgroundColor: colors.limeStrong,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    shadowColor: colors.limeStrong,
    shadowOpacity: 0.55,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  label: { fontSize: 12, fontWeight: "700", fontFamily: "Inter_700Bold", color: colors.onAccent, flexShrink: 1 },
  pendingDot: {
    position: "absolute",
    top: -2,
    right: -3,
    width: 8,
    height: 8,
    borderRadius: 99,
    backgroundColor: colors.ink,
    borderWidth: 1.5,
    borderColor: "#262626",
  },
});
