import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { LoginScreen } from "@/screens/auth/LoginScreen";
import { ResetPinScreen } from "@/screens/auth/ResetPinScreen";
import { colors } from "@/theme";
import type { AuthStackParamList } from "./types";

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="ResetPin" component={ResetPinScreen} />
    </Stack.Navigator>
  );
}
