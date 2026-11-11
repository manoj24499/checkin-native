import { View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { LiveMapScreen } from "@/screens/map/LiveMapScreen";

/**
 * The `Map` tab: the exact same LiveMapScreen that Home opens as the
 * Dashboard stack's `LiveMap` full-screen modal, just hosted in a tab.
 *
 * Only mounted while the tab is focused. Tabs otherwise stay mounted after
 * their first visit, and LiveMapScreen runs a high-accuracy foreground
 * location watch (every ~5 s) for as long as it's mounted — fine for a
 * modal that's closed when you're done, but in a tab it would keep the GPS
 * busy in the background while the user is on Home/Requests/Profile.
 *
 * Its close button calls navigation.goBack(): as a modal that pops back to
 * Home; as a tab the tab router's default `firstRoute` back behaviour also
 * lands on Home (Dashboard), so no change to LiveMapScreen was needed.
 */
export function MapTabScreen() {
  const focused = useIsFocused();
  // Same light "map paper" colour as LiveMapScreen's backdrop, so switching tabs doesn't flash black.
  if (!focused) return <View style={{ flex: 1, backgroundColor: "#E9E4DC" }} />;
  return <LiveMapScreen />;
}
