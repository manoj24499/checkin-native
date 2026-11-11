import { useContext } from "react";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";

/**
 * The floating tab bar (68 high, ~22 above the bottom edge) hovers over the screens, so scrolling content
 * needs this much bottom room (bar + gap + a little breathing space).
 */
export const TAB_BAR_CLEARANCE = 96;

/** Bottom padding to add under scrolling content: the bar's clearance inside the tabs, 0 elsewhere (auth, modals). */
export function useTabBarClearance() {
  const inTabs = useContext(BottomTabBarHeightContext) !== undefined;
  return inTabs ? TAB_BAR_CLEARANCE : 0;
}
