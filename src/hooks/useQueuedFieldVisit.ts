import { useCallback, useState } from "react";
import { useLogFieldVisit } from "@/hooks/useLogFieldVisit";
import { getErrorMessage } from "@/utils/errors";
import type { FieldVisitRequest } from "@/types";

export interface PendingVisit {
  key: string;
  name: string;
  status: "saving" | "failed";
  error?: string;
  payload: FieldVisitRequest;
}

/**
 * Saves a field visit in the background. The form closes the instant the
 * employee taps Save and the visit appears in the list as "Saving…" — the
 * photo upload and server work happen behind it, so nothing blocks the screen.
 * If it fails (no signal in the field is common), the entry stays as "Failed"
 * with Retry/Remove instead of the data being lost.
 */
export function useQueuedFieldVisit() {
  const logVisit = useLogFieldVisit();
  const [pending, setPending] = useState<PendingVisit[]>([]);

  const send = useCallback(
    async (item: PendingVisit) => {
      try {
        await logVisit.mutateAsync(item.payload);
        setPending((list) => list.filter((p) => p.key !== item.key));
      } catch (error) {
        setPending((list) =>
          list.map((p) =>
            p.key === item.key
              ? { ...p, status: "failed", error: getErrorMessage(error, "Couldn't save this visit.") }
              : p,
          ),
        );
      }
    },
    [logVisit],
  );

  const submit = useCallback(
    (payload: FieldVisitRequest) => {
      const item: PendingVisit = {
        key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: payload.name,
        status: "saving",
        payload,
      };
      setPending((list) => [...list, item]);
      void send(item);
    },
    [send],
  );

  const retry = useCallback(
    (key: string) => {
      const item = pending.find((p) => p.key === key);
      if (!item) return;
      const next: PendingVisit = { ...item, status: "saving", error: undefined };
      setPending((list) => list.map((p) => (p.key === key ? next : p)));
      void send(next);
    },
    [pending, send],
  );

  const remove = useCallback((key: string) => {
    setPending((list) => list.filter((p) => p.key !== key));
  }, []);

  return { pending, submit, retry, remove };
}
