import { useCallback, useMemo } from "react";
import { useAuthStore } from "@/store/authStore";
import { useVisitQueueStore } from "@/store/visitQueueStore";
import { enqueueVisit, removeVisit, retryVisit, syncAllQueues } from "@/services/visitQueue";
import type { FieldVisitRequest } from "@/types";

export interface PendingVisit {
  key: string;
  name: string;
  status: "saving" | "failed";
  error?: string;
  /** The visit as typed. `photo` is empty here — it's kept in its own storage row (see services/visitQueue.ts). */
  payload: FieldVisitRequest;
}

/**
 * Saves a field visit in the background. The form closes the instant the
 * employee taps Save and the visit appears in the list as "Saving…". It is
 * saved on the phone first (services/visitQueue.ts), so it survives no signal,
 * leaving the screen and the app being closed, and is sent automatically when
 * possible (see useOfflineQueueSync). Every screen using this hook sees the
 * same list. A visit the server rejects for good shows as "Failed" with
 * Retry/Remove.
 */
export function useQueuedFieldVisit() {
  const employeeCode = useAuthStore((s) => s.user?.employeeCode);
  const items = useVisitQueueStore((s) => s.items);

  const pending = useMemo<PendingVisit[]>(
    () =>
      items
        .filter((i) => i.employeeCode === employeeCode)
        .map((i) => ({
          key: i.key,
          name: i.name,
          status: i.status,
          error: i.error,
          payload: { ...i.payload, photo: "", clientId: i.clientId, reachedAt: i.reachedAt },
        })),
    [items, employeeCode],
  );

  const submit = useCallback(
    (payload: FieldVisitRequest) => {
      void enqueueVisit(payload, employeeCode ?? "")
        .then(() => syncAllQueues())
        .catch(() => {});
    },
    [employeeCode],
  );

  const retry = useCallback((key: string) => {
    void retryVisit(key)
      .then(() => syncAllQueues())
      .catch(() => {});
  }, []);

  const remove = useCallback((key: string) => {
    void removeVisit(key);
  }, []);

  return { pending, submit, retry, remove };
}
