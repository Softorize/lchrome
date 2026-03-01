import { create } from 'zustand';
import type { ProviderConfig, ModelInfo } from '@/types/ai-provider';

export interface ProviderState {
  providers: ProviderConfig[];
  activeProviderId: string | null;
  activeModelId: string | null;
  availableModels: ModelInfo[];

  setProviders: (providers: ProviderConfig[]) => void;
  setActiveProvider: (providerId: string) => void;
  setActiveModel: (modelId: string) => void;
  setAvailableModels: (models: ModelInfo[]) => void;
  addProvider: (provider: ProviderConfig) => void;
  updateProvider: (id: string, updates: Partial<ProviderConfig>) => void;
  removeProvider: (id: string) => void;
}

export const useProviderStore = create<ProviderState>((set, get) => ({
  providers: [],
  activeProviderId: null,
  activeModelId: null,
  availableModels: [],

  setProviders: (providers) => {
    set({ providers });
  },

  setActiveProvider: (providerId) => {
    set({ activeProviderId: providerId, availableModels: [], activeModelId: null });
  },

  setActiveModel: (modelId) => {
    set({ activeModelId: modelId });
  },

  setAvailableModels: (models) => {
    set({ availableModels: models });
  },

  addProvider: (provider) => {
    set((state) => ({
      providers: [...state.providers, provider],
    }));
  },

  updateProvider: (id, updates) => {
    set((state) => ({
      providers: state.providers.map((p) =>
        p.id === id ? { ...p, ...updates } : p,
      ),
    }));
  },

  removeProvider: (id) => {
    set((state) => {
      const newProviders = state.providers.filter((p) => p.id !== id);
      const newState: Partial<ProviderState> = { providers: newProviders };

      if (state.activeProviderId === id) {
        newState.activeProviderId = newProviders[0]?.id ?? null;
        newState.activeModelId = null;
        newState.availableModels = [];
      }

      return newState;
    });
  },
}));
