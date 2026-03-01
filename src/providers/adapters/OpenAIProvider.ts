import { BaseProvider } from '@/providers/base/BaseProvider';
import type {
  ModelInfo,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
  ToolCall,
} from '@/types/ai-provider';
import { StreamParser } from '@/providers/streaming/StreamParser';

interface OpenAIChatResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIStreamChunk {
  id: string;
  model: string;
  choices: Array<{
    delta: {
      role?: string;
      content?: string | null;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: 'function';
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenAIProvider extends BaseProvider {
  protected getAuthHeaders(): Record<string, string> {
    if (!this.config.apiKey) return {};
    return { Authorization: `Bearer ${this.config.apiKey}` };
  }

  async ping(): Promise<boolean> {
    try {
      await this.api.get('/v1/models');
      return true;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const data = await this.api.get<{ data: Array<{ id: string }> }>('/v1/models');
      return data.data.map((m) => ({
        id: m.id,
        name: m.id,
        provider: 'openai' as const,
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
    const data = await this.api.post<OpenAIChatResponse>('/v1/chat/completions', body);

    const choice = data.choices[0];
    return {
      content: choice.message.content ?? '',
      toolCalls: choice.message.tool_calls?.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      })),
      finishReason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : 'stop',
      model: data.model,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  }

  async *stream(request: CompletionRequest): AsyncIterable<StreamChunk> {
    await this.waitForRateLimit();

    const body = this.buildRequestBody(request, true);
    const parser = new StreamParser('sse');
    const toolCallBuffers = new Map<number, { id: string; name: string; args: string }>();

    for await (const raw of this.streamClient.stream(
      `${this.config.baseUrl}/v1/chat/completions`,
      body,
      this.getAuthHeaders(),
    )) {
      for (const jsonStr of parser.parse(raw)) {
        try {
          const chunk = JSON.parse(jsonStr) as OpenAIStreamChunk;
          const delta = chunk.choices[0]?.delta;

          if (delta?.content) {
            yield { type: 'text', text: delta.content };
          }

          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (tc.id) {
                toolCallBuffers.set(tc.index, {
                  id: tc.id,
                  name: tc.function?.name ?? '',
                  args: tc.function?.arguments ?? '',
                });
                yield {
                  type: 'tool_call_start',
                  toolCall: { id: tc.id, name: tc.function?.name ?? '' },
                  toolCallIndex: tc.index,
                };
              } else {
                const buf = toolCallBuffers.get(tc.index);
                if (buf && tc.function?.arguments) {
                  buf.args += tc.function.arguments;
                  yield {
                    type: 'tool_call_delta',
                    toolCall: { arguments: {} },
                    toolCallIndex: tc.index,
                  };
                }
              }
            }
          }

          const finishReason = chunk.choices[0]?.finish_reason;
          if (finishReason === 'tool_calls') {
            for (const [idx, buf] of toolCallBuffers) {
              yield {
                type: 'tool_call_end',
                toolCall: {
                  id: buf.id,
                  name: buf.name,
                  arguments: JSON.parse(buf.args || '{}'),
                },
                toolCallIndex: idx,
              };
            }
            toolCallBuffers.clear();
          }

          if (chunk.usage) {
            yield {
              type: 'usage',
              usage: {
                promptTokens: chunk.usage.prompt_tokens,
                completionTokens: chunk.usage.completion_tokens,
                totalTokens: chunk.usage.total_tokens,
              },
            };
          }

          if (finishReason === 'stop' || finishReason === 'tool_calls') {
            yield { type: 'done' };
          }
        } catch {
          // Skip malformed chunks
        }
      }
    }
  }

  protected buildRequestBody(request: CompletionRequest, stream: boolean) {
    const messages = request.messages.map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'tool' as const,
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
          tool_call_id: m.toolCallId,
        };
      }

      const msg: Record<string, unknown> = {
        role: m.role,
        content: typeof m.content === 'string'
          ? m.content
          : m.content.map((p) =>
              p.type === 'image'
                ? { type: 'image_url', image_url: { url: p.imageUrl ?? `data:${p.mimeType};base64,${p.imageBase64}` } }
                : { type: 'text', text: p.text },
            ),
      };

      if (m.toolCalls) {
        msg.tool_calls = m.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        }));
      }

      return msg;
    });

    const body: Record<string, unknown> = {
      model: request.model,
      messages,
      stream,
      temperature: request.temperature ?? this.config.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? this.config.maxTokens ?? 4096,
    };

    if (stream) {
      body.stream_options = { include_usage: true };
    }

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
}
