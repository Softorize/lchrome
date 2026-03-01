import { create } from 'zustand';

export interface ToolCallUI {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: string;
  isExecuting?: boolean;
}

export interface ChatMessageUI {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: ToolCallUI[];
  timestamp: number;
  model?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessageUI[];
  createdAt: number;
  updatedAt: number;
  providerId?: string;
  modelId?: string;
}

export interface ChatState {
  messages: ChatMessageUI[];
  isLoading: boolean;
  currentConversationId: string | null;
  conversations: Conversation[];

  addMessage: (message: ChatMessageUI) => void;
  updateMessage: (id: string, updates: Partial<ChatMessageUI>) => void;
  clearMessages: () => void;
  setLoading: (loading: boolean) => void;
  createConversation: (title?: string) => string;
  loadConversation: (conversation: Conversation) => void;
  setConversations: (conversations: Conversation[]) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  currentConversationId: null,
  conversations: [],

  addMessage: (message) => {
    set((state) => ({
      messages: [...state.messages, message],
    }));
  },

  updateMessage: (id, updates) => {
    set((state) => ({
      messages: state.messages.map((msg) =>
        msg.id === id ? { ...msg, ...updates } : msg,
      ),
    }));
  },

  clearMessages: () => {
    set({ messages: [], currentConversationId: null });
  },

  setLoading: (loading) => {
    set({ isLoading: loading });
  },

  createConversation: (title?: string) => {
    const id = crypto.randomUUID();
    const conversation: Conversation = {
      id,
      title: title ?? 'New Conversation',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set((state) => ({
      conversations: [conversation, ...state.conversations],
      currentConversationId: id,
      messages: [],
    }));
    return id;
  },

  loadConversation: (conversation) => {
    set({
      currentConversationId: conversation.id,
      messages: [...conversation.messages],
    });
  },

  setConversations: (conversations) => {
    set({ conversations });
  },
}));
