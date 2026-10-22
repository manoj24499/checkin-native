import { useEffect } from "react";
import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import type { QueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import {
  hasPendingOfflineItems,
  loadOfflineQueue,
  onOfflineQueueSynced,
  syncOfflineQueue,
} from "@/services/offlineQueue";

// While something is waiting and the app is open, try again this often even
// without a connectivity change (NetInfo can say "connected" on a network
// that doesn't actually reach the server, and then never fire again).
const RETRY_INTERVAL_MS = 60_000;

/**
 * Sends offline-saved check-ins/outs (see services/offlineQueue.ts) when the
 * connection comes back, when the app returns to the foreground, after
 * sign-in/bootstrap, and every minute while anything is pending. Concurrent
 * triggers are collapsed by syncOfflineQueue itself. Mounted once, for the
 * app's lifetime, from AppProviders.
 */
export function useOfflineQueueSync(queryClient: QueryClient) {
  useEffect(() => {
    void loadOfflineQueue();

    const offSynced = onOfflineQueueSynced(() => {
      // Same keys useCheckInOut refreshes after an online check-in/out.
      void queryClient.invalidateQueries({ queryKey: ["attendance-status"] });
      void queryClient.invalidateQueries({ queryKey: ["attendance-history"] });
    });

    const offNet = NetInfo.addEventListener((state) => {
      if (state.isConnected) void syncOfflineQueue();
    });

    const appStateSub = AppState.addEventListener("change", (status) => {
      if (status === "active") void syncOfflineQueue();
    });

    // After bootstrap/login (or a different employee signing in).
    const offAuth = useAuthStore.subscribe((state, prev) => {
      if (
        state.status === "authenticated" &&
        (prev.status !== "authenticated" || state.user?.employeeCode !== prev.user?.employeeCode)
      ) {
        void syncOfflineQueue();
      }
    });

    const interval = setInterval(() => {
      if (AppState.currentState === "active" && hasPendingOfflineItems()) void syncOfflineQueue();
    }, RETRY_INTERVAL_MS);

    return () => {
      offSynced();
      offNet();
      appStateSub.remove();
      offAuth();
      clearInterval(interval);
    };
  }, [queryClient]);
}
