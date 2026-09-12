import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ProfileScreen } from "@/screens/profile/ProfileScreen";
import { ChangePinScreen } from "@/screens/profile/ChangePinScreen";
import { AttendanceHistoryScreen } from "@/screens/history/AttendanceHistoryScreen";
import type { ProfileStackParamList } from "./types";

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileHome" component={ProfileScreen} />
      <Stack.Screen name="ChangePin" component={ChangePinScreen} options={{ presentation: "modal" }} />
      <Stack.Screen name="History" component={AttendanceHistoryScreen} />
    </Stack.Navigator>
  );
}
