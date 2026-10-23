import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ProfileScreen } from "@/screens/profile/ProfileScreen";
import { ChangePinScreen } from "@/screens/profile/ChangePinScreen";
import { ReportIssueScreen } from "@/screens/profile/ReportIssueScreen";
import { AttendanceHistoryScreen } from "@/screens/history/AttendanceHistoryScreen";
import { colors } from "@/theme";
import type { ProfileStackParamList } from "./types";

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="ProfileHome" component={ProfileScreen} />
      <Stack.Screen name="ChangePin" component={ChangePinScreen} options={{ presentation: "modal" }} />
      <Stack.Screen name="History" component={AttendanceHistoryScreen} />
      <Stack.Screen name="ReportIssue" component={ReportIssueScreen} options={{ presentation: "modal" }} />
    </Stack.Navigator>
  );
}
