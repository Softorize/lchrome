import { OpenAICompatProvider } from './OpenAICompatProvider';
import type { ProviderConfig } from '@/types/ai-provider';

/**
 * LM Studio provider - defaults to localhost:1234, fully OpenAI-compatible.
 */
export class LMStudioProvider extends OpenAICompatProvider {
  constructor(config: ProviderConfig) {
    super({
      ...config,
      baseUrl: config.baseUrl || 'http://localhost:1234',
    });
  }
}
