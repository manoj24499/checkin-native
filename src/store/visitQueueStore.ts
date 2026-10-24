import { create } from "zustand";
import type { FieldVisitRequest } from "@/types";

/**
 * In-memory mirror of the field-visit queue for the UI. The source of truth
 * (and its persistence) lives in services/visitQueue.ts — same split as
 * offlineQueueStore: only that service writes the queue, and each photo is
 * kept in its own AsyncStorage row, not here.
 */

//  - "saving": saved on the phone, waiting to be sent (or being sent). Stays
//    "saving" through no signal / server hiccups / "check in first" — it is
//    retried automatically.
//  - "failed": the server rejected it for good — kept with the reason until
//    the employee retries or removes it.
export type VisitQueueStatus = "saving" | "failed";

/** The visit as typed in the form, minus the photo (stored separately) and the queue's own fields. */
export type QueuedVisitPayload = Omit<FieldVisitRequest, "photo" | "clientId" | "reachedAt">;

export interface VisitQueueItem {
  key: string;
  /** Idempotency key sent to the server: a resend never creates a second visit. */
  clientId: string;
  /** When the worker tapped Save (device clock) — sent as `reachedAt`. */
  reachedAt: string;
  /** The employee who saved it; only their sign-in sends it. */
  employeeCode: string;
  name: string;
  status: VisitQueueStatus;
  error?: string;
  attempts: number;
  hasPhoto: boolean;
  payload: QueuedVisitPayload;
}

interface VisitQueueState {
  loaded: boolean;
  items: VisitQueueItem[];
}

export const useVisitQueueStore = create<VisitQueueState>(() => ({
  loaded: false,
  items: [],
}));
