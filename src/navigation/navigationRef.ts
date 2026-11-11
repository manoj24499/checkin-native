import { createNavigationContainerRef } from "@react-navigation/native";
import type { AppTabParamList } from "./types";

/** The app's NavigationContainer (see AppProviders) — for navigating from
 * outside a screen, e.g. when a push notification is tapped. */
export const navigationRef = createNavigationContainerRef<AppTabParamList>();
