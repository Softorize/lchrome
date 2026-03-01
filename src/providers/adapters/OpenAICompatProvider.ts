import { OpenAIProvider } from './OpenAIProvider';
import type { ProviderConfig } from '@/types/ai-provider';

/**
 * Generic OpenAI-compatible provider.
 * Works with any endpoint that implements the OpenAI chat completions API.
 */
export class OpenAICompatProvider extends OpenAIProvider {
  constructor(config: ProviderConfig) {
    super(config);
  }

  async ping(): Promise<boolean> {
    try {
      // Try the standard OpenAI models endpoint
      await this.api.get('/v1/models');
      return true;
    } catch {
      // Some providers don't have /v1/models, try a minimal completion
      try {
        const models = await this.listModels();
        return models.length > 0;
      } catch {
        return false;
      }
    }
  }
}
