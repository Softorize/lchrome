import { createStore } from 'zustand/vanilla';
import type { ProviderConfig, ModelInfo } from '@/types/ai-provider';

export interface AppState {
  // Provider state
  providers: ProviderConfig[];
  activeProviderId: string | null;
  activeModelId: string | null;
  availableModels: ModelInfo[];

  // UI state
  sidebarOpen: boolean;
  settingsOpen: boolean;
  theme: 'light' | 'dark' | 'system';

  // Connection state
  mcpConnected: boolean;
  nativeHostConnected: boolean;
}

export interface AppActions {
  setProviders: (providers: ProviderConfig[]) => void;
  addProvider: (provider: ProviderConfig) => void;
  updateProvider: (id: string, updates: Partial<ProviderConfig>) => void;
  removeProvider: (id: string) => void;
  setActiveProvider: (id: string | null) => void;
  setActiveModel: (id: string | null) => void;
  setAvailableModels: (models: ModelInfo[]) => void;
  setSidebarOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setMcpConnected: (connected: boolean) => void;
  setNativeHostConnected: (connected: boolean) => void;
}

export type AppStore = AppState & AppActions;

export const createAppStore = (initialState?: Partial<AppState>) =>
  createStore<AppStore>((set) => ({
    // Initial state
    providers: [],
    activeProviderId: null,
    activeModelId: null,
    availableModels: [],
    sidebarOpen: false,
    settingsOpen: false,
    theme: 'system',
    mcpConnected: false,
    nativeHostConnected: false,
    ...initialState,

    // Actions
    setProviders: (providers) => set({ providers }),
    addProvider: (provider) =>
      set((state) => ({ providers: [...state.providers, provider] })),
    updateProvider: (id, updates) =>
      set((state) => ({
        providers: state.providers.map((p) =>
          p.id === id ? { ...p, ...updates } : p,
        ),
      })),
    removeProvider: (id) =>
      set((state) => ({
        providers: state.providers.filter((p) => p.id !== id),
      })),
    setActiveProvider: (id) => set({ activeProviderId: id }),
    setActiveModel: (id) => set({ activeModelId: id }),
    setAvailableModels: (models) => set({ availableModels: models }),
    setSidebarOpen: (open) => set({ sidebarOpen: open }),
    setSettingsOpen: (open) => set({ settingsOpen: open }),
    setTheme: (theme) => set({ theme }),
    setMcpConnected: (connected) => set({ mcpConnected: connected }),
    setNativeHostConnected: (connected) => set({ nativeHostConnected: connected }),
  }));
