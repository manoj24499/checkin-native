import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { DashboardScreen } from "@/screens/dashboard/DashboardScreen";
import { LiveMapScreen } from "@/screens/map/LiveMapScreen";
import { TodaysPlacesScreen } from "@/screens/places/TodaysPlacesScreen";
import { NavigationScreen } from "@/screens/navigation/NavigationScreen";
import { ReimbursementScreen } from "@/screens/reimbursement/ReimbursementScreen";
import { colors } from "@/theme";
import type { DashboardStackParamList } from "./types";

const Stack = createNativeStackNavigator<DashboardStackParamList>();

export function DashboardNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="DashboardHome" component={DashboardScreen} />
      <Stack.Screen name="LiveMap" component={LiveMapScreen} options={{ presentation: "fullScreenModal" }} />
      <Stack.Screen name="TodaysPlaces" component={TodaysPlacesScreen} />
      <Stack.Screen
        name="Navigate"
        component={NavigationScreen}
        options={{ presentation: "fullScreenModal", gestureEnabled: false }}
      />
      <Stack.Screen name="Reimbursement" component={ReimbursementScreen} />
    </Stack.Navigator>
  );
}
