import type { MessageBus } from '@/infrastructure/messaging/MessageBus';
import type { ProviderConfig, CompletionRequest } from '@/types/ai-provider';
import type { IProvider } from '@/providers/base/IProvider';
import { ProviderRegistry } from '@/providers/base/ProviderRegistry';
import { Logger } from '@/core/logger/Logger';

const logger = new Logger('ProviderHandler');
let registry: ProviderRegistry | null = null;

function getRegistry(): ProviderRegistry {
  if (!registry) {
    registry = new ProviderRegistry();
  }
  return registry;
}

export function setupProviderHandler(bus: MessageBus): void {
  bus.on('provider:ping', async (payload: { providerId: string }) => {
    const provider = getRegistry().get(payload.providerId);
    if (!provider) return { success: false, error: 'Provider not found' };
    const ok = await provider.ping();
    return { success: ok };
  });

  bus.on('provider:list-models', async (payload: { providerId: string }) => {
    const provider = getRegistry().get(payload.providerId);
    if (!provider) return { models: [], error: 'Provider not found' };
    const models = await provider.listModels();
    return { models };
  });

  bus.on('provider:complete', async (payload: { providerId: string; request: CompletionRequest }) => {
    const provider = getRegistry().get(payload.providerId);
    if (!provider) throw new Error('Provider not found');
    return await provider.complete(payload.request);
  });

  bus.on('provider:abort', (payload: { providerId: string }) => {
    const provider = getRegistry().get(payload.providerId);
    if (provider) provider.abort();
    return { success: true };
  });

  logger.info('Provider handler initialized');
}

export function getProviderRegistry(): ProviderRegistry {
  return getRegistry();
}
