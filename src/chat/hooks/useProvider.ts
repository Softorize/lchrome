import { useCallback, useEffect } from 'react';
import { useProviderStore } from '../store/providerSlice';
import type { ProviderConfig, ModelInfo } from '@/types/ai-provider';

// Fetch models directly from the provider API (bypasses service worker messaging)
async function fetchModelsDirectly(provider: ProviderConfig): Promise<ModelInfo[]> {
  try {
    let url: string;
    let headers: Record<string, string> = { 'Content-Type': 'application/json' };

    if (provider.type === 'ollama') {
      url = `${provider.baseUrl}/api/tags`;
    } else if (provider.type === 'google') {
      url = `${provider.baseUrl}/v1beta/models${provider.apiKey ? `?key=${provider.apiKey}` : ''}`;
    } else {
      // OpenAI-compatible (openai, openai-compat, lmstudio, anthropic)
      url = `${provider.baseUrl}/v1/models`;
      if (provider.apiKey) {
        headers['Authorization'] = `Bearer ${provider.apiKey}`;
      }
    }

    const resp = await fetch(url, { headers });
    if (!resp.ok) return [];
    const data = await resp.json();

    if (provider.type === 'ollama') {
      return (data.models ?? []).map((m: { name: string }) => ({
        id: m.name,
        name: m.name,
        provider: provider.type,
        supportsTools: true,
        supportsStreaming: true,
      }));
    }

    // OpenAI-compatible format
    const models = data.data ?? data.models ?? [];
    return models.map((m: { id?: string; name?: string }) => ({
      id: m.id ?? m.name ?? 'unknown',
      name: m.name ?? m.id ?? 'unknown',
      provider: provider.type,
      supportsTools: true,
      supportsStreaming: true,
    }));
  } catch (error) {
    console.error('Failed to fetch models:', error);
    return [];
  }
}

export function useProvider() {
  const providers = useProviderStore((s) => s.providers);
  const activeProviderId = useProviderStore((s) => s.activeProviderId);
  const activeModelId = useProviderStore((s) => s.activeModelId);
  const availableModels = useProviderStore((s) => s.availableModels);
  const setProviders = useProviderStore((s) => s.setProviders);
  const setActiveProvider = useProviderStore((s) => s.setActiveProvider);
  const setActiveModel = useProviderStore((s) => s.setActiveModel);
  const setAvailableModels = useProviderStore((s) => s.setAvailableModels);
  const addProvider = useProviderStore((s) => s.addProvider);
  const updateProvider = useProviderStore((s) => s.updateProvider);
  const removeProvider = useProviderStore((s) => s.removeProvider);

  // Load providers and auto-select model on mount
  useEffect(() => {
    async function init() {
      const result = await chrome.storage.local.get(['providers', 'activeProviderId', 'activeModelId']);
      let storedProviders = (result.providers ?? []) as ProviderConfig[];

      // Auto-configure default LLaMA provider if none exist
      if (storedProviders.length === 0) {
        const defaultProvider: ProviderConfig = {
          id: 'default-llama',
          type: 'openai-compat',
          name: 'LLaMA Server',
          baseUrl: 'http://192.168.1.247:8081',
          defaultModel: 'Qwen3.5-35B-A3B',
          enabled: true,
        };
        storedProviders = [defaultProvider];
        await chrome.storage.local.set({ providers: storedProviders });
      }

      setProviders(storedProviders);

      // Pick the active provider
      const providerId = result.activeProviderId ?? storedProviders[0]?.id;
      if (!providerId) return;

      setActiveProvider(providerId);
      const provider = storedProviders.find((p) => p.id === providerId);
      if (!provider) return;

      // Fetch models directly from API
      const models = await fetchModelsDirectly(provider);
      setAvailableModels(models);

      // Auto-select model
      const savedModelId = result.activeModelId;
      const modelToSelect =
        models.find((m) => m.id === savedModelId) ??
        models.find((m) => m.id === provider.defaultModel) ??
        models[0];

      if (modelToSelect) {
        setActiveModel(modelToSelect.id);
      }
    }

    init();
  }, [setProviders, setActiveProvider, setActiveModel, setAvailableModels]);

  // Persist selections
  useEffect(() => {
    if (activeProviderId) chrome.storage.local.set({ activeProviderId });
  }, [activeProviderId]);

  useEffect(() => {
    if (activeModelId) chrome.storage.local.set({ activeModelId });
  }, [activeModelId]);

  const selectProvider = useCallback(
    async (providerId: string) => {
      setActiveProvider(providerId);
      const provider = providers.find((p) => p.id === providerId);
      if (!provider) return;

      const models = await fetchModelsDirectly(provider);
      setAvailableModels(models);

      if (models.length > 0) {
        const modelToSelect =
          models.find((m) => m.id === provider.defaultModel) ?? models[0];
        setActiveModel(modelToSelect.id);
      }
    },
    [providers, setActiveProvider, setAvailableModels, setActiveModel],
  );

  const selectModel = useCallback(
    (modelId: string) => {
      setActiveModel(modelId);
    },
    [setActiveModel],
  );

  const testConnection = useCallback(
    async (providerId: string): Promise<boolean> => {
      const provider = providers.find((p) => p.id === providerId);
      if (!provider) return false;
      try {
        const models = await fetchModelsDirectly(provider);
        return models.length > 0;
      } catch {
        return false;
      }
    },
    [providers],
  );

  const refreshModels = useCallback(
    async (providerId?: string): Promise<ModelInfo[]> => {
      const id = providerId ?? activeProviderId;
      if (!id) return [];
      const provider = providers.find((p) => p.id === id);
      if (!provider) return [];
      const models = await fetchModelsDirectly(provider);
      setAvailableModels(models);
      return models;
    },
    [providers, activeProviderId, setAvailableModels],
  );

  const saveProvider = useCallback(
    (config: ProviderConfig) => {
      const exists = providers.find((p) => p.id === config.id);
      if (exists) {
        updateProvider(config.id, config);
      } else {
        addProvider(config);
      }
      const updated = exists
        ? providers.map((p) => (p.id === config.id ? config : p))
        : [...providers, config];
      chrome.storage.local.set({ providers: updated });
    },
    [providers, addProvider, updateProvider],
  );

  const activeProvider = providers.find((p) => p.id === activeProviderId) ?? null;
  const activeModel = availableModels.find((m) => m.id === activeModelId) ?? null;

  return {
    providers,
    activeProvider,
    activeModel,
    models: availableModels,
    selectProvider,
    selectModel,
    testConnection,
    refreshModels,
    addProvider: saveProvider,
    updateProvider,
    removeProvider,
  };
}
