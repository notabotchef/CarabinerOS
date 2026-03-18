import { create } from "zustand";

interface WorkspaceState {
  activeLocationId: string | null;
  activeModule: string;
  isChatOpen: boolean;
  selectedItemId: string | null;

  setActiveLocation: (id: string | null) => void;
  setActiveModule: (module: string) => void;
  toggleChat: () => void;
  setChatOpen: (open: boolean) => void;
  setSelectedItem: (id: string | null) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeLocationId: null,
  activeModule: "home",
  isChatOpen: false,
  selectedItemId: null,

  setActiveLocation: (id) => set({ activeLocationId: id }),
  setActiveModule: (module) => set({ activeModule: module }),
  toggleChat: () => set((s) => ({ isChatOpen: !s.isChatOpen })),
  setChatOpen: (open) => set({ isChatOpen: open }),
  setSelectedItem: (id) => set({ selectedItemId: id }),
}));
