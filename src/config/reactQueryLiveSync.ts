import { useEffect } from "react";
import { AppState, AppStateStatus, Platform } from "react-native";
import { focusManager, onlineManager, type QueryClient } from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";

// Some Android OEM skins (MIUI/HyperOS in particular — see the identical
// blip guards in RootNavigator.tsx for the biometric lock and location
// tracking start) fire spurious background→active blips a couple of
// seconds apart, e.g. while the location foreground-service notification
// for attendance tracking is posted/kept alive. Reacting to every single
// one flips React Query's focus state false→true repeatedly, and every
// query with the default `refetchOnWindowFocus` refetches each time — a
// refetch storm that shows up as the screen flickering every couple of
// seconds while checked in. This is a *cooldown* window, not a
// wait-before-acting delay (see leading-edge note below) — it collapses a
// burst of blips into a single reaction instead of one per blip.
const FOCUS_COOLDOWN_MS = 8000;

/**
 * React Query's "refetch on window focus / on reconnect" only works out of
 * the box on the web (it listens for browser events that don't exist in
 * React Native). Without this wiring, screens only ever update from an
 * explicit invalidateQueries call or a manual pull-to-refresh — reopening
 * the app or regaining connectivity does nothing on its own.
 */
export function useReactQueryLiveSync(queryClient: QueryClient) {
  useEffect(() => {
    let cooldownTimeout: ReturnType<typeof setTimeout> | null = null;

    const onAppStateChange = (status: AppStateStatus) => {
      if (Platform.OS === "web") return;
      // Leading-edge: react to the *first* transition in a burst immediately,
      // then ignore everything else until the cooldown clears. The previous
      // version waited for AppState to go quiet before reacting at all —
      // technically correct, but on a resume-after-hours-backgrounded (the
      // case that actually matters), a real person looks at the stale
      // Dashboard and pulls to refresh well before an 8s trailing debounce
      // ever fires, so the auto-fix below never gets observed as working.
      // Reacting instantly on the first event and swallowing the rest for
      // FOCUS_COOLDOWN_MS keeps the original anti-flicker protection (still
      // only one reaction per burst) while making a genuine resume instant.
      if (cooldownTimeout) return;
      cooldownTimeout = setTimeout(() => {
        cooldownTimeout = null;
      }, FOCUS_COOLDOWN_MS);

      const nowFocused = status === "active";
      focusManager.setFocused(nowFocused);
      // `focusManager.setFocused(true)` is *supposed* to be enough on its
      // own (it drives React Query's default `refetchOnWindowFocus`) —
      // but this app's tab navigator keeps every screen (and its query
      // observers) permanently mounted once signed in (see
      // RootNavigator.tsx's own comment on why AppTabs never unmounts),
      // so there's no natural "remount → fresh fetch" fallback the way a
      // freshly-mounted screen would get. User-reported: reopening the
      // app after sitting backgrounded for a while showed the Dashboard's
      // check-in status stale (whatever it was before backgrounding, not
      // reflecting anything that happened on the server since) until a
      // manual pull-to-refresh. An explicit invalidation here is the same
      // "don't rely on an implicit mechanism for something this visible"
      // reasoning already applied to useAttendanceStatus's own refetch
      // logic (see that hook's comment) — it only affects currently
      // *active* (mounted/observed) queries, so this doesn't fetch
      // anything nobody's looking at.
      if (nowFocused) {
        void queryClient.invalidateQueries();
      }
    };

    const subscription = AppState.addEventListener("change", onAppStateChange);
    // onlineManager manages its own cleanup internally on re-registration —
    // it has no public unsubscribe, so this is registered once for the
    // app's lifetime (standard TanStack Query React Native setup).
    onlineManager.setEventListener((setOnline) =>
      NetInfo.addEventListener((state) => setOnline(!!state.isConnected)),
    );
    return () => {
      if (cooldownTimeout) clearTimeout(cooldownTimeout);
      subscription.remove();
    };
  }, []);
}
