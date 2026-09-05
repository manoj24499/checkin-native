import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { DashboardScreen } from "@/screens/dashboard/DashboardScreen";
import { LiveMapScreen } from "@/screens/map/LiveMapScreen";
import { RequestTimedPermissionScreen } from "@/screens/dashboard/RequestTimedPermissionScreen";
import { RequestOvertimeScreen } from "@/screens/dashboard/RequestOvertimeScreen";
import type { DashboardStackParamList } from "./types";

const Stack = createNativeStackNavigator<DashboardStackParamList>();

export function DashboardNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DashboardHome" component={DashboardScreen} />
      <Stack.Screen name="LiveMap" component={LiveMapScreen} options={{ presentation: "fullScreenModal" }} />
      <Stack.Screen
        name="RequestPermission"
        component={RequestTimedPermissionScreen}
        options={{ presentation: "modal" }}
      />
      <Stack.Screen
        name="RequestOvertime"
        component={RequestOvertimeScreen}
        options={{ presentation: "modal" }}
      />
    </Stack.Navigator>
  );
}
