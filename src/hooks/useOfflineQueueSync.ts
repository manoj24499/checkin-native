import { useEffect } from "react";
import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import type { QueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import {
  hasPendingOfflineItems,
  loadOfflineQueue,
  onOfflineQueueSynced,
} from "@/services/offlineQueue";
import { hasWaitingVisits, loadVisitQueue, onVisitsSent, syncAllQueues, syncVisitQueue } from "@/services/visitQueue";

// While something is waiting and the app is open, try again this often even
// without a connectivity change (NetInfo can say "connected" on a network
// that doesn't actually reach the server, and then never fire again).
const RETRY_INTERVAL_MS = 60_000;

/**
 * Sends offline-saved check-ins/outs (see services/offlineQueue.ts), then
 * saved field visits (services/visitQueue.ts — they need their check-in on the
 * server first), when the
 * connection comes back, when the app returns to the foreground, after
 * sign-in/bootstrap, and every minute while anything is pending. Concurrent
 * triggers are collapsed by syncOfflineQueue / syncVisitQueue themselves. Mounted once, for the
 * app's lifetime, from AppProviders.
 */
export function useOfflineQueueSync(queryClient: QueryClient) {
  useEffect(() => {
    void loadOfflineQueue();
    void loadVisitQueue();

    const offSynced = onOfflineQueueSynced(() => {
      // Same keys useCheckInOut refreshes after an online check-in/out.
      void queryClient.invalidateQueries({ queryKey: ["attendance-status"] });
      void queryClient.invalidateQueries({ queryKey: ["attendance-history"] });
      // A check-in just reached the server: visits waiting for it can go now.
      void syncVisitQueue();
    });

    const offVisits = onVisitsSent(() => {
      // Same keys useLogFieldVisit refreshes after an online visit.
      void queryClient.invalidateQueries({ queryKey: ["field-summary"] });
      void queryClient.invalidateQueries({ queryKey: ["assigned-places"] });
    });

    const offNet = NetInfo.addEventListener((state) => {
      if (state.isConnected) void syncAllQueues();
    });

    const appStateSub = AppState.addEventListener("change", (status) => {
      if (status === "active") void syncAllQueues();
    });

    // After bootstrap/login (or a different employee signing in).
    const offAuth = useAuthStore.subscribe((state, prev) => {
      if (
        state.status === "authenticated" &&
        (prev.status !== "authenticated" || state.user?.employeeCode !== prev.user?.employeeCode)
      ) {
        void syncAllQueues();
      }
    });

    const interval = setInterval(() => {
      if (AppState.currentState === "active" && (hasPendingOfflineItems() || hasWaitingVisits())) void syncAllQueues();
    }, RETRY_INTERVAL_MS);

    return () => {
      offSynced();
      offVisits();
      offNet();
      appStateSub.remove();
      offAuth();
      clearInterval(interval);
    };
  }, [queryClient]);
}
