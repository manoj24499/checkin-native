import { useEffect } from "react";
import { AppState, AppStateStatus, Platform } from "react-native";
import { focusManager, onlineManager } from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";

// Some Android OEM skins (MIUI/HyperOS in particular — see the identical
// blip guards in RootNavigator.tsx for the biometric lock and location
// tracking start) fire spurious background→active blips a couple of
// seconds apart, e.g. while the location foreground-service notification
// for attendance tracking is posted/kept alive. Reacting to every single
// one flips React Query's focus state false→true repeatedly, and every
// query with the default `refetchOnWindowFocus` refetches each time — a
// refetch storm that shows up as the screen flickering every couple of
// seconds while checked in. Debouncing collapses a burst of blips into one
// settled update once the AppState actually stops changing.
const FOCUS_DEBOUNCE_MS = 8000;

/**
 * React Query's "refetch on window focus / on reconnect" only works out of
 * the box on the web (it listens for browser events that don't exist in
 * React Native). Without this wiring, screens only ever update from an
 * explicit invalidateQueries call or a manual pull-to-refresh — reopening
 * the app or regaining connectivity does nothing on its own.
 */
export function useReactQueryLiveSync() {
  useEffect(() => {
    let debounceTimeout: ReturnType<typeof setTimeout> | null = null;

    const onAppStateChange = (status: AppStateStatus) => {
      if (Platform.OS === "web") return;
      if (debounceTimeout) clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        focusManager.setFocused(status === "active");
      }, FOCUS_DEBOUNCE_MS);
    };

    const subscription = AppState.addEventListener("change", onAppStateChange);
    // onlineManager manages its own cleanup internally on re-registration —
    // it has no public unsubscribe, so this is registered once for the
    // app's lifetime (standard TanStack Query React Native setup).
    onlineManager.setEventListener((setOnline) =>
      NetInfo.addEventListener((state) => setOnline(!!state.isConnected)),
    );
    return () => {
      if (debounceTimeout) clearTimeout(debounceTimeout);
      subscription.remove();
    };
  }, []);
}
