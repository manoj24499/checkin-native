import { useMemo } from "react";
import { useAttendanceStatus } from "./useAttendanceStatus";
import { useAuth } from "./useAuth";
import { useOfflineQueueStore, type OfflineQueueItem } from "@/store/offlineQueueStore";
import { localDateKey } from "@/services/offlineQueue";
import type { KioskStatus } from "@/types";

/**
 * Today's status as the employee should see it: the last known server status
 * (live, or the copy cached on the phone when there's no connection) with any
 * check-in/out still waiting in the offline queue applied on top. A queued
 * CHECK_IN reads as "checked in (pending sync)" so the CHECK_OUT can be queued
 * too; a queued CHECK_IN + CHECK_OUT reads as done for the day. Server data is
 * never modified — this is a view over it.
 *
 * `query` is the underlying useAttendanceStatus query, for refetch/refreshing.
 * Anything that drives *server* calls for the active session (timed
 * permissions, overtime, ...) should keep using `query.data`: a queued
 * check-in has no session on the server yet.
 */
export function useEffectiveAttendanceStatus(employeeCode: string | undefined) {
  const query = useAttendanceStatus(employeeCode);
  const { user } = useAuth();
  const items = useOfflineQueueStore((s) => s.items);
  const lastStatus = useOfflineQueueStore((s) => s.lastStatus);

  const derived = useMemo(() => {
    const today = localDateKey(new Date());
    const queued: OfflineQueueItem[] = items.filter(
      (i) =>
        i.employeeCode === employeeCode &&
        (i.status === "pending" || i.status === "syncing") &&
        localDateKey(new Date(i.capturedAt)) === today,
    );
    const cached =
      lastStatus && lastStatus.employeeCode === employeeCode && lastStatus.dateKey === today
        ? lastStatus.status
        : undefined;
    let data: KioskStatus | undefined = query.data ?? cached;
    const fromCache = !query.data && !!cached;

    if (queued.length > 0 && (!data || data.exists) && user) {
      let s: Extract<KioskStatus, { exists: true }> =
        data && data.exists
          ? data
          : {
              // Never fetched today (cold start offline): start from "nothing yet".
              exists: true,
              name: user.name,
              workMode: user.workMode,
              checkedIn: false,
              checkedOut: false,
              checkInAt: null,
              // Unknown — ask for the photo rather than have the check-out rejected later.
              checkOutPhotoRequired: true,
              isPaused: false,
              pauses: [],
              lateMinutes: null,
              leaveType: "NONE",
              checkInMode: null,
              shiftStartTime: null,
              shiftEndTime: null,
            };
      for (const item of queued) {
        if (item.action === "CHECK_IN" && !s.checkedIn) {
          s = {
            ...s,
            checkedIn: true,
            checkedOut: false,
            checkInAt: item.capturedAt,
            checkInMode: item.checkInMode ?? null,
            isPaused: false,
            pauses: [],
          };
        } else if (item.action === "CHECK_OUT" && s.checkedIn) {
          s = { ...s, checkedOut: true };
        }
      }
      data = s;
    }

    return {
      data,
      fromCache,
      pendingCheckIn: queued.find((i) => i.action === "CHECK_IN") ?? null,
      pendingCheckOut: queued.find((i) => i.action === "CHECK_OUT") ?? null,
    };
  }, [items, lastStatus, query.data, employeeCode, user]);

  return {
    query,
    ...derived,
    // With something to show (cached or queued), a failed/paused fetch isn't a reason to block the screen.
    isLoading: query.isLoading && !derived.data,
    isError: query.isError && !derived.data,
  };
}
