import { useEffect } from "react";
import * as Notifications from "expo-notifications";
import { useQueryClient } from "@tanstack/react-query";
import { navigationRef } from "@/navigation/navigationRef";
import { useHybridPromptStore } from "@/store/hybridPromptStore";
import type { HybridPlace } from "@/types";

type PushData = Record<string, unknown> | undefined;

const handledTapIds = new Set<string>();

const asPlace = (v: unknown): HybridPlace | null => (v === "OFFICE" || v === "HOME" ? v : null);
const asString = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/** Records a HYBRID push in the prompt store; returns true if it was one. */
function recordHybridPush(data: PushData): boolean {
  if (!data) return false;
  if (data.type === "HYBRID_DEPARTURE") {
    const heading = asPlace(data.suggestedHeading);
    if (heading) useHybridPromptStore.getState().setDeparture(heading, asString(data.segmentId));
    return true;
  }
  if (data.type === "HYBRID_TRANSIT_EXPIRED") {
    const heading = asPlace(data.heading);
    if (heading) useHybridPromptStore.getState().setTransitExpired(heading, asString(data.segmentId));
    return true;
  }
  return false;
}

/** Opens the Home tab (where the place card / arrival prompt lives). Retries
 * briefly while the navigator is still mounting (cold start from a tap). */
function openHome(attempt = 0) {
  if (navigationRef.isReady()) {
    navigationRef.navigate("Dashboard", { screen: "DashboardHome" });
    return;
  }
  if (attempt < 20) setTimeout(() => openHome(attempt + 1), 250);
}

/**
 * HYBRID pushes (see HYBRID_API_CONTRACT.md):
 *  - HYBRID_DEPARTURE ("Heading home?") — tapping opens Home with
 *    "Switch to {suggestedHeading}" highlighted on the place card.
 *  - HYBRID_TRANSIT_EXPIRED ("Are you home yet?") — tapping opens Home, where
 *    the Arrived / Still travelling prompt shows (from work-segment's
 *    transitExpired).
 * Received while the app is open: same hint is recorded, and the segment /
 * status refetched so the card is current. Mount once while signed in.
 */
export function useHybridPushHandling(enabled: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["work-segment"] });
      void queryClient.invalidateQueries({ queryKey: ["attendance-status"] });
    };

    const handleTap = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      // The cold-start lookup and the listener can both report the same tap.
      const id = response.notification.request.identifier;
      if (handledTapIds.has(id)) return;
      handledTapIds.add(id);
      const data = response.notification.request.content.data as PushData;
      if (!recordHybridPush(data)) return;
      refresh();
      openHome();
    };

    // App launched from a tap on one of these (cold start).
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (cancelled || !response) return;
        // Only act on a recent tap — this keeps returning the last response.
        const sentAt = response.notification.date;
        if (sentAt && Date.now() - sentAt > 30 * 60 * 1000) return;
        handleTap(response);
      })
      .catch(() => {});

    const tapSub = Notifications.addNotificationResponseReceivedListener(handleTap);
    const receiveSub = Notifications.addNotificationReceivedListener((notification) => {
      if (recordHybridPush(notification.request.content.data as PushData)) refresh();
    });

    return () => {
      cancelled = true;
      tapSub.remove();
      receiveSub.remove();
    };
  }, [enabled, queryClient]);
}
