import type { MessageBus } from '@/infrastructure/messaging/MessageBus';
import type { ProviderConfig, CompletionRequest } from '@/types/ai-provider';
import type { IProvider } from '@/providers/base/IProvider';
import { ProviderRegistry } from '@/providers/base/ProviderRegistry';
import { Logger } from '@/core/logger/Logger';

const logger = new Logger('ProviderHandler');
let registry: ProviderRegistry | null = null;
let registryReady: Promise<void> | null = null;

function getRegistry(): ProviderRegistry {
  if (!registry) {
    registry = new ProviderRegistry();
  }
  return registry;
}

async function ensureReady(): Promise<ProviderRegistry> {
  const reg = getRegistry();
  if (registryReady) await registryReady;
  return reg;
}

export function setupProviderHandler(bus: MessageBus): void {
  // Load providers from storage on startup and track the promise
  registryReady = getRegistry().loadFromStorage().then(() => {
    logger.info('Providers loaded from storage');
    registryReady = null;
  }).catch((err) => {
    logger.error('Failed to load providers from storage', err);
    registryReady = null;
  });

  bus.on('provider:ping', async (payload: { providerId: string }) => {
    const reg = await ensureReady();
    const provider = reg.get(payload.providerId);
    if (!provider) return { success: false, error: 'Provider not found' };
    const ok = await provider.ping();
    return { success: ok };
  });

  bus.on('provider:list-models', async (payload: { providerId: string }) => {
    const reg = await ensureReady();
    let provider = reg.get(payload.providerId);

    // If provider not in registry, try loading from storage on-demand
    if (!provider) {
      await reg.loadFromStorage();
      provider = reg.get(payload.providerId);
    }

    if (!provider) return { models: [], error: 'Provider not found' };
    const models = await provider.listModels();
    return { models };
  });

  bus.on('provider:complete', async (payload: { providerId: string; request: CompletionRequest }) => {
    const reg = await ensureReady();
    const provider = reg.get(payload.providerId);
    if (!provider) throw new Error('Provider not found');
    return await provider.complete(payload.request);
  });

  bus.on('provider:abort', async (payload: { providerId: string }) => {
    const reg = await ensureReady();
    const provider = reg.get(payload.providerId);
    if (provider) provider.abort();
    return { success: true };
  });

  logger.info('Provider handler initialized');
}

export function getProviderRegistry(): ProviderRegistry {
  return getRegistry();
}
