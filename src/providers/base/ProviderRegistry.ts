import type { IProvider } from './IProvider';
import type { ProviderConfig, ProviderType } from '@/types/ai-provider';
import { OllamaProvider } from '@/providers/adapters/OllamaProvider';
import { OpenAIProvider } from '@/providers/adapters/OpenAIProvider';
import { AnthropicProvider } from '@/providers/adapters/AnthropicProvider';
import { GoogleProvider } from '@/providers/adapters/GoogleProvider';
import { OpenAICompatProvider } from '@/providers/adapters/OpenAICompatProvider';
import { LMStudioProvider } from '@/providers/adapters/LMStudioProvider';
import { Logger } from '@/core/logger/Logger';

type ProviderFactory = (config: ProviderConfig) => IProvider;

const PROVIDER_FACTORIES: Record<ProviderType, ProviderFactory> = {
  ollama: (config) => new OllamaProvider(config),
  openai: (config) => new OpenAIProvider(config),
  anthropic: (config) => new AnthropicProvider(config),
  google: (config) => new GoogleProvider(config),
  'openai-compat': (config) => new OpenAICompatProvider(config),
  lmstudio: (config) => new LMStudioProvider(config),
};

export class ProviderRegistry {
  private providers = new Map<string, IProvider>();
  private logger = new Logger('ProviderRegistry');

  register(config: ProviderConfig): IProvider {
    const factory = PROVIDER_FACTORIES[config.type];
    if (!factory) {
      throw new Error(`Unknown provider type: ${config.type}`);
    }

    // Dispose existing provider if replacing
    const existing = this.providers.get(config.id);
    if (existing) {
      existing.dispose();
    }

    const provider = factory(config);
    this.providers.set(config.id, provider);
    this.logger.info(`Registered provider: ${config.name} (${config.type})`);
    return provider;
  }

  get(id: string): IProvider | undefined {
    return this.providers.get(id);
  }

  remove(id: string): void {
    const provider = this.providers.get(id);
    if (provider) {
      provider.dispose();
      this.providers.delete(id);
    }
  }

  getAll(): IProvider[] {
    return Array.from(this.providers.values());
  }

  getAllConfigs(): ProviderConfig[] {
    return this.getAll().map((p) => p.config);
  }

  clear(): void {
    for (const provider of this.providers.values()) {
      provider.dispose();
    }
    this.providers.clear();
  }

  async loadFromStorage(): Promise<void> {
    const result = await chrome.storage.local.get('providers');
    const configs = (result.providers ?? []) as ProviderConfig[];
    for (const config of configs) {
      try {
        this.register(config);
      } catch (error) {
        this.logger.error(`Failed to register provider ${config.name}`, error);
      }
    }
  }

  async saveToStorage(): Promise<void> {
    const configs = this.getAllConfigs();
    await chrome.storage.local.set({ providers: configs });
  }
}
