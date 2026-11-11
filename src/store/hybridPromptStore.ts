import { create } from "zustand";
import type { HybridPlace } from "@/types";

/**
 * HYBRID push hints the app received while running (see useHybridPushHandling):
 *  - `departure`: the server saw them leave the office/home ("Heading home?") —
 *    Home's place card highlights "Switch to {suggestedHeading}".
 *  - `transitExpiredAt`: the "Are you home yet?" push arrived — the card
 *    itself is driven by GET work-segment's transitExpired, this only feeds
 *    the Notifications list.
 * In memory only: the server state (work-segment) stays the source of truth,
 * and Home clears these as soon as the segment moves on.
 */
interface HybridPromptState {
  departure: { suggestedHeading: HybridPlace; segmentId: string | null; at: number } | null;
  transitExpired: { heading: HybridPlace; segmentId: string | null; at: number } | null;
  setDeparture: (suggestedHeading: HybridPlace, segmentId: string | null) => void;
  setTransitExpired: (heading: HybridPlace, segmentId: string | null) => void;
  clearDeparture: () => void;
  clearTransitExpired: () => void;
}

export const useHybridPromptStore = create<HybridPromptState>((set) => ({
  departure: null,
  transitExpired: null,
  setDeparture: (suggestedHeading, segmentId) => set({ departure: { suggestedHeading, segmentId, at: Date.now() } }),
  setTransitExpired: (heading, segmentId) => set({ transitExpired: { heading, segmentId, at: Date.now() } }),
  clearDeparture: () => set({ departure: null }),
  clearTransitExpired: () => set({ transitExpired: null }),
}));
