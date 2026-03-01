import { useCallback, useEffect } from 'react';
import { useProviderStore } from '../store/providerSlice';
import type { ProviderConfig, ModelInfo } from '@/types/ai-provider';
import type { ExtensionMessage, ExtensionResponse } from '@/types/messages';

async function sendToBackground<T>(
  type: ExtensionMessage['type'],
  payload: unknown,
): Promise<ExtensionResponse<T>> {
  const message: ExtensionMessage = {
    type,
    id: crypto.randomUUID(),
    payload,
    source: 'sidebar',
  };
  return chrome.runtime.sendMessage(message);
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

  // Load providers from storage on mount
  useEffect(() => {
    async function loadProviders() {
      const result = await chrome.storage.local.get(['providers', 'activeProviderId', 'activeModelId']);
      const storedProviders = (result.providers ?? []) as ProviderConfig[];
      setProviders(storedProviders);

      if (result.activeProviderId) {
        setActiveProvider(result.activeProviderId);
      } else if (storedProviders.length > 0) {
        setActiveProvider(storedProviders[0].id);
      }

      if (result.activeModelId) {
        setActiveModel(result.activeModelId);
      }
    }

    loadProviders();
  }, [setProviders, setActiveProvider, setActiveModel]);

  // Persist active selections
  useEffect(() => {
    if (activeProviderId) {
      chrome.storage.local.set({ activeProviderId });
    }
  }, [activeProviderId]);

  useEffect(() => {
    if (activeModelId) {
      chrome.storage.local.set({ activeModelId });
    }
  }, [activeModelId]);

  const selectProvider = useCallback(
    async (providerId: string) => {
      setActiveProvider(providerId);
      // Automatically refresh models when switching provider
      const response = await sendToBackground<{ models: ModelInfo[] }>(
        'provider:list-models',
        { providerId },
      );
      if (response.success && response.data) {
        setAvailableModels(response.data.models);
        if (response.data.models.length > 0) {
          const provider = providers.find((p) => p.id === providerId);
          const defaultModel = provider?.defaultModel;
          const modelToSelect =
            response.data.models.find((m) => m.id === defaultModel) ??
            response.data.models[0];
          setActiveModel(modelToSelect.id);
        }
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
      const response = await sendToBackground<{ success: boolean }>(
        'provider:ping',
        { providerId },
      );
      return response.success && (response.data?.success ?? false);
    },
    [],
  );

  const refreshModels = useCallback(
    async (providerId?: string): Promise<ModelInfo[]> => {
      const id = providerId ?? activeProviderId;
      if (!id) return [];

      const response = await sendToBackground<{ models: ModelInfo[] }>(
        'provider:list-models',
        { providerId: id },
      );

      if (response.success && response.data) {
        setAvailableModels(response.data.models);
        return response.data.models;
      }

      return [];
    },
    [activeProviderId, setAvailableModels],
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
    addProvider,
    updateProvider,
    removeProvider,
  };
}
