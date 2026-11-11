import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

// There is no notification feed endpoint: the Notifications screen derives its items from data the app
// already loads (leave / overtime requests, late arrivals). Only the local read + dismissed marks live here,
// persisted so they survive restarts. Item ids embed the status they describe, so a status change makes a
// fresh (unread) notification.
const KEY = "checkin.notifications.v1";

interface NotificationState {
  read: Record<string, true>;
  dismissed: Record<string, true>;
  markRead: (ids: string[]) => void;
  dismiss: (id: string) => void;
  dismissAll: (ids: string[]) => void;
}

function persist(state: Pick<NotificationState, "read" | "dismissed">) {
  AsyncStorage.setItem(KEY, JSON.stringify({ read: state.read, dismissed: state.dismissed })).catch(() => {});
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  read: {},
  dismissed: {},
  markRead: (ids) => {
    const read = { ...get().read };
    let changed = false;
    for (const id of ids) {
      if (!read[id]) {
        read[id] = true;
        changed = true;
      }
    }
    if (!changed) return;
    set({ read });
    persist({ read, dismissed: get().dismissed });
  },
  dismiss: (id) => {
    const dismissed = { ...get().dismissed, [id]: true as const };
    const read = { ...get().read, [id]: true as const };
    set({ dismissed, read });
    persist({ read, dismissed });
  },
  dismissAll: (ids) => {
    const dismissed = { ...get().dismissed };
    const read = { ...get().read };
    for (const id of ids) {
      dismissed[id] = true;
      read[id] = true;
    }
    set({ dismissed, read });
    persist({ read, dismissed });
  },
}));

AsyncStorage.getItem(KEY)
  .then((raw) => {
    if (!raw) return;
    const saved = JSON.parse(raw) as Partial<Pick<NotificationState, "read" | "dismissed">>;
    // Merge so marks made before this load finished aren't lost.
    const cur = useNotificationStore.getState();
    useNotificationStore.setState({
      read: { ...saved.read, ...cur.read },
      dismissed: { ...saved.dismissed, ...cur.dismissed },
    });
  })
  .catch(() => {});
