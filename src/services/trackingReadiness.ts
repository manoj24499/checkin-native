import { Linking, Platform } from "react-native";
import * as Location from "expo-location";
import * as Battery from "expo-battery";
import * as IntentLauncher from "expo-intent-launcher";

const PACKAGE_NAME = "com.anonymous.checkinapp";

export interface TrackingReadiness {
  /** Location while the app is open. */
  foreground: boolean;
  /** "Allow all the time" — without it Android stops location once the app is in the background. */
  background: boolean;
  /** True when Android's battery saver is still allowed to restrict the app (the usual reason tracking dies). */
  batteryRestricted: boolean;
  ok: boolean;
}

/**
 * What the phone must allow for a field worker's route to keep recording while the
 * phone is in a pocket. Used at check-in and from the "Fix now" prompt.
 */
export async function checkTrackingReadiness(): Promise<TrackingReadiness> {
  const [fg, bg] = await Promise.all([
    Location.getForegroundPermissionsAsync().catch(() => null),
    Location.getBackgroundPermissionsAsync().catch(() => null),
  ]);
  let batteryRestricted = false;
  if (Platform.OS === "android") {
    // `true` = battery optimization is still ON for this app. If the OS can't tell us, assume fine.
    batteryRestricted = await Battery.isBatteryOptimizationEnabledAsync().catch(() => false);
  }
  const foreground = fg?.status === "granted";
  const background = bg?.status === "granted";
  return { foreground, background, batteryRestricted, ok: foreground && background && !batteryRestricted };
}

/** Asks for "Allow all the time"; if the system won't show its prompt any more, opens the app's settings page. */
export async function requestAlwaysLocation(): Promise<void> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status === "granted") {
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status === "granted") return;
  }
  await Linking.openSettings();
}

/** Opens Android's "stop restricting this app's battery" screen for the app. */
export async function openBatterySettings(): Promise<void> {
  if (Platform.OS !== "android") {
    await Linking.openSettings();
    return;
  }
  try {
    await IntentLauncher.startActivityAsync("android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS", {
      data: `package:${PACKAGE_NAME}`,
    });
  } catch {
    try {
      await IntentLauncher.startActivityAsync("android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS");
    } catch {
      await Linking.openSettings();
    }
  }
}
