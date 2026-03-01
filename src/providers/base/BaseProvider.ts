import type { IProvider } from './IProvider';
import type {
  ProviderConfig,
  ModelInfo,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
} from '@/types/ai-provider';
import { APIClient } from '@/infrastructure/api/APIClient';
import { StreamingClient } from '@/infrastructure/api/StreamingClient';
import { RateLimiter } from '@/infrastructure/security/RateLimiter';
import { Logger } from '@/core/logger/Logger';

export abstract class BaseProvider implements IProvider {
  protected api: APIClient;
  protected streamClient: StreamingClient;
  protected rateLimiter: RateLimiter;
  protected logger: Logger;
  protected abortController: AbortController | null = null;

  constructor(public readonly config: ProviderConfig) {
    this.logger = new Logger(`Provider:${config.type}`);
    this.api = new APIClient({
      baseUrl: config.baseUrl,
      headers: this.getAuthHeaders(),
    });
    this.streamClient = new StreamingClient();
    this.rateLimiter = config.rateLimit
      ? RateLimiter.fromRPM(config.rateLimit.requestsPerMinute)
      : RateLimiter.fromRPM(60);
  }

  abstract ping(): Promise<boolean>;
  abstract listModels(): Promise<ModelInfo[]>;

  abstract complete(request: CompletionRequest): Promise<CompletionResponse>;
  abstract stream(request: CompletionRequest): AsyncIterable<StreamChunk>;

  abort(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.streamClient.abort();
  }

  dispose(): void {
    this.abort();
  }

  protected getAuthHeaders(): Record<string, string> {
    return {};
  }

  protected createAbortSignal(): AbortSignal {
    this.abortController = new AbortController();
    return this.abortController.signal;
  }

  protected async waitForRateLimit(): Promise<void> {
    await this.rateLimiter.acquire();
  }
}
