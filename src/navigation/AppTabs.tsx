import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Svg, { Circle, Path } from "react-native-svg";
import { DashboardNavigator } from "./DashboardNavigator";
import { CheckInOutScreen } from "@/screens/checkin/CheckInOutScreen";
import { AttendanceHistoryScreen } from "@/screens/history/AttendanceHistoryScreen";
import { ProfileNavigator } from "./ProfileNavigator";
import { colors } from "@/theme";
import type { AppTabParamList } from "./types";

const Tab = createBottomTabNavigator<AppTabParamList>();

const ICON_SIZE = 20;
const ICON_STROKE_WIDTH = 1.75;

function IconBase({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <Svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={ICON_STROKE_WIDTH}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

function DashboardIcon({ color }: { color: string }) {
  return (
    <IconBase color={color}>
      <Path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
      <Path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </IconBase>
  );
}

function CheckInIcon({ color }: { color: string }) {
  return (
    <IconBase color={color}>
      <Circle cx="12" cy="12" r="10" />
      <Path d="m9 12 2 2 4-4" />
    </IconBase>
  );
}

function HistoryIcon({ color }: { color: string }) {
  return (
    <IconBase color={color}>
      <Path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <Path d="M3 3v5h5" />
      <Path d="M12 7v5l4 2" />
    </IconBase>
  );
}

function ProfileIcon({ color }: { color: string }) {
  return (
    <IconBase color={color}>
      <Circle cx="12" cy="8" r="5" />
      <Path d="M20 21a8 8 0 0 0-16 0" />
    </IconBase>
  );
}

const TAB_ICONS: Record<keyof AppTabParamList, (props: { color: string }) => React.ReactElement> = {
  Dashboard: DashboardIcon,
  CheckIn: CheckInIcon,
  History: HistoryIcon,
  Profile: ProfileIcon,
};

export function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarActiveBackgroundColor: colors.primaryMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarItemStyle: { borderRadius: 12, marginHorizontal: 4, marginVertical: 4 },
        tabBarLabelStyle: { fontSize: 9.5, fontWeight: "500", letterSpacing: 0.8 },
        tabBarIcon: ({ color }) => {
          const Icon = TAB_ICONS[route.name];
          return <Icon color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardNavigator} />
      <Tab.Screen name="CheckIn" component={CheckInOutScreen} options={{ title: "Check In/Out" }} />
      <Tab.Screen name="History" component={AttendanceHistoryScreen} />
      <Tab.Screen name="Profile" component={ProfileNavigator} />
    </Tab.Navigator>
  );
}
