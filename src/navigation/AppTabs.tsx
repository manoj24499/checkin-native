import { useEffect, useState } from "react";
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { createBottomTabNavigator, type BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { getFocusedRouteNameFromRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
const BAR_HEIGHT = 64;
const FAB_SIZE = 64;
const FAB_RING = 4;
// How far the centre button rises above the bar's top edge.
const FAB_RISE = 24;

// Full-screen flows where the bar would only get in the way (mockup: no tab
// bar on turn-by-turn navigation).
const HIDE_BAR_ON: string[] = ["Navigate"];

type TabRouteName = keyof AppTabParamList;

const TAB_ICONS: Record<Exclude<TabRouteName, "CheckIn">, IconName> = {
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
 * Lime pill tab bar with a raised ink Check-in button in the middle (Lime
 * redesign). Laid out in normal flow (not floating over the screens) so no
 * screen needs extra bottom padding; the strip above the pill leaves room
 * for the raised button so its whole surface stays tappable on Android.
 * Tab press/long-press events are emitted exactly like the stock bar, so
 * nested stacks still pop-to-top when their tab is re-pressed.
 */
function LimeTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const keyboardVisible = useAndroidKeyboardVisible();
  const focusedRoute = state.routes[state.index];
  const nestedName = getFocusedRouteNameFromRoute(focusedRoute);
  if (nestedName && HIDE_BAR_ON.includes(nestedName)) return null;
  // The bar is taller than the stock one (room for the raised button); on
  // Android the window resizes for the keyboard, which would park it right
  // above the keys and squeeze forms like the check-in PIN. Same effect as
  // the stock bar's tabBarHideOnKeyboard.
  if (keyboardVisible) return null;

  // Same contract as the stock tab bar: emit tabPress (lets a focused nested
  // stack pop to top), then navigate unless already focused or prevented.
  const pressTab = (key: string, name: string, params: object | undefined, focused: boolean) => {
    const event = navigation.emit({ type: "tabPress", target: key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) navigation.navigate(name, params);
  };
  const checkInIndex = state.routes.findIndex((r) => r.name === "CheckIn");
  const checkInRoute = checkInIndex >= 0 ? state.routes[checkInIndex] : null;
  const checkInFocused = state.index === checkInIndex;

  return (
    <View style={[styles.outer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const name = route.name as TabRouteName;
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const label = options.title ?? route.name;

          const onPress = () => pressTab(route.key, route.name, route.params, focused);
          const onLongPress = () => navigation.emit({ type: "tabLongPress", target: route.key });

          // Placeholder keeping the bar's 5-slot rhythm; the raised button
          // itself is drawn below, outside the bar, so its top half (above
          // the bar's edge) is still inside a parent's bounds and tappable on
          // Android.
          if (name === "CheckIn") return <View key={route.key} style={styles.fabSlot} />;

          const color = focused ? colors.ink : colors.tabInactive;
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={onLongPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              style={[styles.tab, focused && styles.tabActive]}
            >
              {name === "Requests" ? (
                <RequestsIcon color={color} />
              ) : (
                <Icon name={TAB_ICONS[name]} size={ICON_SIZE} color={color} strokeWidth={ICON_STROKE_WIDTH} />
              )}
              <Text style={[styles.label, { color }, focused && styles.labelActive]} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {checkInRoute ? (
        <View pointerEvents="box-none" style={styles.fabLayer}>
          <Pressable
            onPress={() => pressTab(checkInRoute.key, checkInRoute.name, checkInRoute.params, checkInFocused)}
            onLongPress={() => navigation.emit({ type: "tabLongPress", target: checkInRoute.key })}
            accessibilityRole="tab"
            accessibilityState={{ selected: checkInFocused }}
            accessibilityLabel={
              descriptors[checkInRoute.key].options.tabBarAccessibilityLabel ??
              descriptors[checkInRoute.key].options.title ??
              checkInRoute.name
            }
            style={({ pressed }) => [styles.fab, checkInFocused && styles.fabActive, pressed && styles.fabPressed]}
          >
            <Icon name="check" size={28} color={colors.lime} strokeWidth={1.8} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export function AppTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <LimeTabBar {...props} />}
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
  outer: {
    backgroundColor: colors.background,
    paddingHorizontal: 10,
    paddingTop: FAB_RISE + 2,
  },
  bar: {
    height: BAR_HEIGHT,
    borderRadius: 30,
    backgroundColor: colors.limePale,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 6,
    ...shadows.tabBar,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 6,
    marginHorizontal: 2,
    borderRadius: 16,
  },
  tabActive: { backgroundColor: colors.glassStrong },
  label: { fontSize: 10, letterSpacing: 0.3, fontWeight: "500", fontFamily: "Inter_500Medium" },
  labelActive: { fontWeight: "700", fontFamily: "Inter_700Bold" },
  pendingDot: {
    position: "absolute",
    top: -1,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 99,
    backgroundColor: colors.ink,
    borderWidth: 1.5,
    borderColor: colors.limePale,
  },
  fabSlot: { width: FAB_SIZE + FAB_RING * 2 + 4, height: BAR_HEIGHT },
  // Spans the outer container; the button sits FAB_RISE above the bar's top edge.
  fabLayer: { position: "absolute", top: 2, left: 0, right: 0, alignItems: "center" },
  fab: {
    width: FAB_SIZE + FAB_RING * 2,
    height: FAB_SIZE + FAB_RING * 2,
    borderRadius: (FAB_SIZE + FAB_RING * 2) / 2,
    backgroundColor: colors.ink,
    borderWidth: FAB_RING,
    borderColor: colors.background, // pale ring separating it from the bar
    alignItems: "center",
    justifyContent: "center",
    ...shadows.fab,
    elevation: 10, // above the bar's own elevation on Android
  },
  fabActive: { borderColor: colors.limeStrong },
  fabPressed: { transform: [{ scale: 0.95 }] },
});
