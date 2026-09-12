import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { employeeService } from "@/api/services";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Registers the device for push notifications and returns an Expo push
 * token. Callers are responsible for sending it to
 * `POST /api/mobile/me/push-token` (see employeeService.registerPushToken) —
 * this function only deals with the OS/Expo side of obtaining the token.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  // Passed explicitly rather than relying on auto-detection — that works
  // reliably in Expo Go, but is a known source of silent failures in a
  // standalone dev-client/production build like this app's, exactly the
  // shape of bug that surfaces as this whole function mysteriously
  // returning null with no visible cause.
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  return token.data;
}

export interface PushTokenRegistrationResult {
  ok: boolean;
  /** Set only on failure — the actual thrown error's message (or a fixed
   * string for the no-permission case), since "check your connection" was
   * previously shown for every failure regardless of real cause (a missing
   * FCM credential, a backend rejection, getExpoPushTokenAsync throwing,
   * etc.), which made this impossible to diagnose from the UI alone. */
  reason?: string;
}

/**
 * Obtains a push token and registers it with the backend in one step —
 * best-effort, never throws. Used at check-in (so the "you've left your
 * work area" auto-pause warning can actually reach the employee, regardless
 * of whether they've separately opted into the unrelated "Shift reminders"
 * toggle in Profile, which defaults to off) and from that toggle itself.
 */
export async function registerPushTokenBestEffort(): Promise<PushTokenRegistrationResult> {
  try {
    const token = await registerForPushNotificationsAsync();
    if (!token) return { ok: false, reason: "No push token was returned (permission not granted?)." };
    await employeeService.registerPushToken(token);
    return { ok: true };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn("Push token registration failed:", error);
    return { ok: false, reason };
  }
}
