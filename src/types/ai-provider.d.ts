export type ProviderType =
  | 'ollama'
  | 'lmstudio'
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'openai-compat';

export interface ProviderConfig {
  id: string;
  type: ProviderType;
  name: string;
  baseUrl: string;
  apiKey?: string;
  defaultModel?: string;
  maxTokens?: number;
  temperature?: number;
  rateLimit?: {
    requestsPerMinute: number;
    tokensPerMinute?: number;
  };
  enabled: boolean;
  custom?: Record<string, unknown>;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: ProviderType;
  contextWindow?: number;
  supportsTools?: boolean;
  supportsVision?: boolean;
  supportsStreaming?: boolean;
}

export interface CompletionRequest {
  model: string;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  signal?: AbortSignal;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | ContentPart[];
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface ContentPart {
  type: 'text' | 'image';
  text?: string;
  imageUrl?: string;
  imageBase64?: string;
  mimeType?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface CompletionResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage?: TokenUsage;
  finishReason?: 'stop' | 'tool_calls' | 'length' | 'error';
  model?: string;
}

export interface StreamChunk {
  type: 'text' | 'tool_call_start' | 'tool_call_delta' | 'tool_call_end' | 'usage' | 'done' | 'error';
  text?: string;
  toolCall?: Partial<ToolCall>;
  toolCallIndex?: number;
  usage?: TokenUsage;
  error?: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}
