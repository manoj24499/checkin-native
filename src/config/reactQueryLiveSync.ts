import { useEffect } from "react";
import { AppState, AppStateStatus, Platform } from "react-native";
import { focusManager, onlineManager } from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";

function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== "web") {
    focusManager.setFocused(status === "active");
  }
}

/**
 * React Query's "refetch on window focus / on reconnect" only works out of
 * the box on the web (it listens for browser events that don't exist in
 * React Native). Without this wiring, screens only ever update from an
 * explicit invalidateQueries call or a manual pull-to-refresh — reopening
 * the app or regaining connectivity does nothing on its own.
 */
export function useReactQueryLiveSync() {
  useEffect(() => {
    const subscription = AppState.addEventListener("change", onAppStateChange);
    // onlineManager manages its own cleanup internally on re-registration —
    // it has no public unsubscribe, so this is registered once for the
    // app's lifetime (standard TanStack Query React Native setup).
    onlineManager.setEventListener((setOnline) =>
      NetInfo.addEventListener((state) => setOnline(!!state.isConnected)),
    );
    return () => {
      subscription.remove();
    };
  }, []);
}
