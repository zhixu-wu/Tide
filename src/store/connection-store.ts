import { create } from "zustand";

import { api } from "@/lib/api";
import type { Connection } from "@/types/connection";

interface ConnectionStoreState {
  connections: Connection[];
  activeId: string | null;
  loading: boolean;
  error: string | null;

  refresh: () => Promise<void>;
  setActive: (id: string | null) => void;
  remove: (id: string) => Promise<void>;
}

export const useConnectionStore = create<ConnectionStoreState>((set, get) => ({
  connections: [],
  activeId: null,
  loading: false,
  error: null,

  async refresh() {
    set({ loading: true, error: null });
    try {
      const connections = await api.listConnections();
      set({ connections, loading: false });
      if (!get().activeId && connections.length > 0) {
        set({ activeId: connections[0].id });
      }
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  setActive(id) {
    set({ activeId: id });
  },

  async remove(id) {
    await api.deleteConnection(id);
    const remaining = get().connections.filter((c) => c.id !== id);
    const nextActive =
      get().activeId === id ? remaining[0]?.id ?? null : get().activeId;
    set({ connections: remaining, activeId: nextActive });
  },
}));
