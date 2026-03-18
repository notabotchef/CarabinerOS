import { create } from "zustand";
import type { ChatMessage, StatusPayload } from "@/lib/chat-helpers";

export interface Conversation {
  id: string;
  name: string | null;
  created_at: string | null;
  last_message: string | null;
  type: string;
  running: boolean;
}

interface WorkspaceState {
  // Location & navigation
  activeLocationId: string | null;
  activeModule: string;

  // Chat dock (workspace pages)
  isChatOpen: boolean;
  chatPrompt: string | null;

  // Chat messages (shared between homepage and dock)
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingStatus: StatusPayload | null;

  // Conversations (multi-chat)
  conversations: Conversation[];
  activeContextId: string | null;

  // Actions — location & navigation
  setActiveLocation: (id: string | null) => void;
  setActiveModule: (module: string) => void;

  // Actions — chat dock
  toggleChat: () => void;
  setChatOpen: (open: boolean) => void;
  setChatPrompt: (prompt: string | null) => void;

  // Actions — chat messages
  addMessage: (msg: ChatMessage) => void;
  appendToLastMessage: (chunk: string) => void;
  setStreaming: (v: boolean) => void;
  setStreamingStatus: (s: StatusPayload | null) => void;
  clearMessages: () => void;

  // Actions — conversations
  setConversations: (convos: Conversation[]) => void;
  setActiveContextId: (id: string | null) => void;
  loadConversation: (id: string, messages: ChatMessage[]) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeLocationId: null,
  activeModule: "home",
  isChatOpen: false,
  chatPrompt: null,
  messages: [],
  isStreaming: false,
  streamingStatus: null,
  conversations: [],
  activeContextId: null,

  setActiveLocation: (id) => set({ activeLocationId: id }),
  setActiveModule: (module) => set({ activeModule: module }),
  toggleChat: () => set((s) => ({ isChatOpen: !s.isChatOpen })),
  setChatOpen: (open) => set({ isChatOpen: open }),
  setChatPrompt: (prompt) => set({ chatPrompt: prompt }),

  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  appendToLastMessage: (chunk) =>
    set((s) => {
      const msgs = [...s.messages];
      if (msgs.length > 0 && msgs[msgs.length - 1].role === "assistant") {
        msgs[msgs.length - 1] = {
          ...msgs[msgs.length - 1],
          content: msgs[msgs.length - 1].content + chunk,
        };
      } else {
        msgs.push({
          id: crypto.randomUUID(),
          role: "assistant",
          content: chunk,
          timestamp: Date.now(),
        });
      }
      return { messages: msgs };
    }),
  setStreaming: (v) => set({ isStreaming: v }),
  setStreamingStatus: (s) => set({ streamingStatus: s }),
  clearMessages: () => set({ messages: [], streamingStatus: null, isStreaming: false }),

  // Conversations
  setConversations: (convos) => set({ conversations: convos }),
  setActiveContextId: (id) => set({ activeContextId: id }),
  loadConversation: (id, messages) =>
    set({
      activeContextId: id,
      messages,
      streamingStatus: null,
      isStreaming: false,
    }),
}));
