import type {
  ProviderConfig,
  ModelInfo,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
} from '@/types/ai-provider';

export interface IProvider {
  readonly config: ProviderConfig;
  ping(): Promise<boolean>;
  listModels(): Promise<ModelInfo[]>;
  complete(request: CompletionRequest): Promise<CompletionResponse>;
  stream(request: CompletionRequest): AsyncIterable<StreamChunk>;
  abort(): void;
  dispose(): void;
}
