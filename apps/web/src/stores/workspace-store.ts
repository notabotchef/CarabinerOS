import { create } from "zustand";

interface WorkspaceState {
  activeLocationId: string | null;
  activeModule: string;
  isChatOpen: boolean;
  chatPrompt: string | null;

  setActiveLocation: (id: string | null) => void;
  setActiveModule: (module: string) => void;
  toggleChat: () => void;
  setChatOpen: (open: boolean) => void;
  setChatPrompt: (prompt: string | null) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeLocationId: null,
  activeModule: "home",
  isChatOpen: false,
  chatPrompt: null,

  setActiveLocation: (id) => set({ activeLocationId: id }),
  setActiveModule: (module) => set({ activeModule: module }),
  toggleChat: () => set((s) => ({ isChatOpen: !s.isChatOpen })),
  setChatOpen: (open) => set({ isChatOpen: open }),
  setChatPrompt: (prompt) => set({ chatPrompt: prompt }),
}));
