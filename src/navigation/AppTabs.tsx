import { useEffect, useState } from "react";
import { Animated, Keyboard, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { createBottomTabNavigator, type BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { getFocusedRouteNameFromRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { DashboardNavigator } from "./DashboardNavigator";
import { MapTabScreen } from "./MapTabScreen";
import { CheckInOutScreen } from "@/screens/checkin/CheckInOutScreen";
import { RequestsScreen } from "@/screens/requests/RequestsScreen";
import { ProfileNavigator } from "./ProfileNavigator";
import { Icon, loopEasing, useLoop, type IconName } from "@/components/ui";
import { useLeaveRequests } from "@/hooks";
import { colors, fontFamilies, gradientDirection, gradients, motion, shadows } from "@/theme";
import type { AppTabParamList } from "./types";

const Tab = createBottomTabNavigator<AppTabParamList>();

const ICON_SIZE = 22;
const ICON_STROKE_WIDTH = 1.8;
const BAR_HEIGHT = 68;
/** Gap between the bar and the screen bottom when there's no (or a small) safe-area inset (mockup: 22). */
const TAB_BAR_BOTTOM_GAP = 22;
const CENTRE_SIZE = 52;

// Full-screen flows where the bar would only get in the way (mockup: no tab
// bar on turn-by-turn navigation).
const HIDE_BAR_ON: string[] = ["Navigate"];

type TabRouteName = keyof AppTabParamList;

const TAB_ICONS: Record<TabRouteName, IconName> = {
  CheckIn: "clock",
  Dashboard: "home",
  Map: "pin",
  Requests: "doc",
  Profile: "person",
};

/** Short labels under the icons (route titles can be longer, e.g. "Check In/Out"). */
const TAB_LABELS: Partial<Record<TabRouteName, string>> = {
  Dashboard: "Home",
  Map: "Map",
  Requests: "Requests",
  Profile: "Profile",
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
      <Icon name="doc" size={ICON_SIZE} color={color} strokeWidth={ICON_STROKE_WIDTH} />
      {hasPending ? <View style={styles.pendingDot} /> : null}
    </View>
  );
}

/**
 * Centre check-in/out button: 52px orange-gradient circle with a dark clock glyph and a "breathe" halo (a soft
 * orange disc behind it that swells ~12px and fades, 2.4s loop; static under reduced motion).
 */
function CentreButton() {
  const t = useLoop({ duration: motion.breatheDuration, pingPong: true, easing: loopEasing.easeOut });
  return (
    <View style={styles.centreWrap}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.breathe,
          {
            opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
            transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, (CENTRE_SIZE + 24) / CENTRE_SIZE] }) }],
          },
        ]}
      />
      <View style={styles.centre}>
        <LinearGradient
          pointerEvents="none"
          colors={gradients.orange}
          start={gradientDirection.diagonal.start}
          end={gradientDirection.diagonal.end}
          style={StyleSheet.absoluteFill}
        />
        <Icon name={TAB_ICONS.CheckIn} size={24} color={colors.onOrange} strokeWidth={1.9} />
      </View>
    </View>
  );
}

/**
 * Floating tab bar (Main.dc.html `.nav`): a 96%-white pill, 68 high, 16 from the sides and ~22 from the
 * bottom, hairline border. Five slots with icon + 10px label (inactive #6B635C, active #B34D05); the centre
 * slot is the gradient check-in button with a breathe halo. It is absolutely positioned (screens scroll
 * underneath it), so screens add `useTabBarClearance()` of bottom padding. Tab press/long-press events are
 * emitted exactly like the stock bar, so nested stacks still pop-to-top when their tab is re-pressed.
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
  const pressTab = (key: string, name: string, _params: object | undefined, focused: boolean) => {
    const event = navigation.emit({ type: "tabPress", target: key, canPreventDefault: true });
    if (focused || event.defaultPrevented) return;
    // Never replay the route's stale params (a Home shortcut leaves { screen: "History" } on the Profile
    // tab); tapping the Profile tab itself always lands on the profile root.
    if (name === "Profile") navigation.navigate(name, { screen: "ProfileHome" });
    else navigation.navigate(name);
  };

  return (
    <View
      pointerEvents="box-none"
      style={[styles.outer, { paddingBottom: Math.max(TAB_BAR_BOTTOM_GAP, insets.bottom + 6) }]}
    >
      <View style={styles.bar}>
        <View style={styles.row}>
          {state.routes.map((route, index) => {
            const name = route.name as TabRouteName;
            const { options } = descriptors[route.key];
            const focused = state.index === index;
            const label = options.title ?? route.name;
            const shortLabel = TAB_LABELS[name] ?? label;
            const isCentre = name === "CheckIn";
            const color = focused ? colors.accentText : colors.textSecondary;
            return (
              <Pressable
                key={route.key}
                onPress={() => pressTab(route.key, route.name, route.params, focused)}
                onLongPress={() => navigation.emit({ type: "tabLongPress", target: route.key })}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
                style={styles.slot}
              >
                {isCentre ? (
                  <CentreButton />
                ) : (
                  <View style={styles.item}>
                    {name === "Requests" ? (
                      <RequestsIcon color={color} />
                    ) : (
                      <Icon name={TAB_ICONS[name]} size={ICON_SIZE} color={color} strokeWidth={ICON_STROKE_WIDTH} />
                    )}
                    <Text style={[styles.label, { color }]} numberOfLines={1}>
                      {shortLabel}
                    </Text>
                  </View>
                )}
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
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.limePale,
    ...shadows.tabBar,
  },
  row: { flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: 8 },
  slot: { flex: 1, alignSelf: "stretch", alignItems: "center", justifyContent: "center" },
  item: { alignItems: "center", justifyContent: "center", gap: 3 },
  label: { fontSize: 10, fontWeight: "500", fontFamily: fontFamilies.medium },
  centreWrap: { width: CENTRE_SIZE, height: CENTRE_SIZE, alignItems: "center", justifyContent: "center" },
  breathe: {
    position: "absolute",
    width: CENTRE_SIZE,
    height: CENTRE_SIZE,
    borderRadius: CENTRE_SIZE / 2,
    backgroundColor: "#FF8A2B",
  },
  centre: {
    width: CENTRE_SIZE,
    height: CENTRE_SIZE,
    borderRadius: CENTRE_SIZE / 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },

  pendingDot: {
    position: "absolute",
    top: -2,
    right: -3,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.pulse,
    borderWidth: 2,
    borderColor: colors.surface,
  },
});
