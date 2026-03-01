import { BaseProvider } from '@/providers/base/BaseProvider';
import type {
  ModelInfo,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
  ChatMessage,
  ToolCall,
} from '@/types/ai-provider';
import { StreamParser } from '@/providers/streaming/StreamParser';

interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  details?: {
    parameter_size?: string;
    quantization_level?: string;
  };
}

interface OllamaChatResponse {
  model: string;
  message: {
    role: string;
    content: string;
    tool_calls?: Array<{
      function: { name: string; arguments: Record<string, unknown> };
    }>;
  };
  done: boolean;
  total_duration?: number;
  eval_count?: number;
  prompt_eval_count?: number;
}

export class OllamaProvider extends BaseProvider {
  async ping(): Promise<boolean> {
    try {
      const response = await fetch(this.config.baseUrl);
      return response.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const data = await this.api.get<{ models: OllamaModel[] }>('/api/tags');
      return data.models.map((m) => ({
        id: m.name,
        name: m.name,
        provider: 'ollama' as const,
        supportsTools: true,
        supportsStreaming: true,
      }));
    } catch (error) {
      this.logger.error('Failed to list models', error);
      return [];
    }
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    await this.waitForRateLimit();

    const body = this.buildRequestBody(request, false);
    const data = await this.api.post<OllamaChatResponse>('/api/chat', body);

    return {
      content: data.message.content,
      toolCalls: this.parseToolCalls(data.message.tool_calls),
      finishReason: data.message.tool_calls?.length ? 'tool_calls' : 'stop',
      model: data.model,
      usage: {
        promptTokens: data.prompt_eval_count ?? 0,
        completionTokens: data.eval_count ?? 0,
        totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
      },
    };
  }

  async *stream(request: CompletionRequest): AsyncIterable<StreamChunk> {
    await this.waitForRateLimit();

    const body = this.buildRequestBody(request, true);
    const parser = new StreamParser('ndjson');
    let content = '';

    for await (const raw of this.streamClient.stream(
      `${this.config.baseUrl}/api/chat`,
      body,
      {},
    )) {
      for (const jsonStr of parser.parse(raw)) {
        try {
          const chunk = JSON.parse(jsonStr) as OllamaChatResponse;

          if (chunk.message?.content) {
            content += chunk.message.content;
            yield { type: 'text', text: chunk.message.content };
          }

          if (chunk.message?.tool_calls) {
            for (let i = 0; i < chunk.message.tool_calls.length; i++) {
              const tc = chunk.message.tool_calls[i];
              yield {
                type: 'tool_call_start',
                toolCall: {
                  id: `call_${crypto.randomUUID().slice(0, 8)}`,
                  name: tc.function.name,
                  arguments: tc.function.arguments,
                },
                toolCallIndex: i,
              };
              yield { type: 'tool_call_end', toolCallIndex: i };
            }
          }

          if (chunk.done) {
            yield {
              type: 'usage',
              usage: {
                promptTokens: chunk.prompt_eval_count ?? 0,
                completionTokens: chunk.eval_count ?? 0,
                totalTokens: (chunk.prompt_eval_count ?? 0) + (chunk.eval_count ?? 0),
              },
            };
            yield { type: 'done' };
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }
  }

  private buildRequestBody(request: CompletionRequest, stream: boolean) {
    const messages = request.messages.map((m) => ({
      role: m.role === 'tool' ? 'assistant' : m.role,
      content: typeof m.content === 'string' ? m.content : m.content.map((p) => p.text).join(''),
    }));

    const body: Record<string, unknown> = {
      model: request.model,
      messages,
      stream,
      options: {
        temperature: request.temperature ?? this.config.temperature ?? 0.7,
        num_predict: request.maxTokens ?? this.config.maxTokens ?? 4096,
      },
    };

    if (request.tools?.length) {
      body.tools = request.tools.map((t) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        },
      }));
    }

    return body;
  }

  private parseToolCalls(
    raw?: Array<{ function: { name: string; arguments: Record<string, unknown> } }>,
  ): ToolCall[] | undefined {
    if (!raw?.length) return undefined;
    return raw.map((tc) => ({
      id: `call_${crypto.randomUUID().slice(0, 8)}`,
      name: tc.function.name,
      arguments: tc.function.arguments,
    }));
  }
}
