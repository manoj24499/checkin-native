import { useContext } from "react";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";

/** The floating glass tab bar hovers over the screens, so scrolling content needs this much bottom room. */
export const TAB_BAR_CLEARANCE = 92;

/** Bottom padding to add under scrolling content: the bar's clearance inside the tabs, 0 elsewhere (auth, modals). */
export function useTabBarClearance() {
  const inTabs = useContext(BottomTabBarHeightContext) !== undefined;
  return inTabs ? TAB_BAR_CLEARANCE : 0;
}
