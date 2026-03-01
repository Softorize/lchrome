import { BaseProvider } from '@/providers/base/BaseProvider';
import type {
  ModelInfo,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
  ChatMessage,
} from '@/types/ai-provider';
import { StreamParser } from '@/providers/streaming/StreamParser';

interface AnthropicResponse {
  id: string;
  model: string;
  content: Array<{
    type: 'text' | 'tool_use';
    text?: string;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
  }>;
  stop_reason: string;
  usage: { input_tokens: number; output_tokens: number };
}

interface AnthropicStreamEvent {
  type: string;
  index?: number;
  content_block?: { type: string; id?: string; name?: string; text?: string; input?: string };
  delta?: { type: string; text?: string; partial_json?: string; stop_reason?: string };
  message?: { usage?: { input_tokens: number; output_tokens: number } };
  usage?: { output_tokens: number };
}

const ANTHROPIC_MODELS: ModelInfo[] = [
  { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', provider: 'anthropic', supportsTools: true, supportsStreaming: true, supportsVision: true },
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic', supportsTools: true, supportsStreaming: true, supportsVision: true },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', provider: 'anthropic', supportsTools: true, supportsStreaming: true, supportsVision: true },
];

export class AnthropicProvider extends BaseProvider {
  protected getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'anthropic-version': '2023-06-01',
    };
    if (this.config.apiKey) {
      headers['x-api-key'] = this.config.apiKey;
    }
    return headers;
  }

  async ping(): Promise<boolean> {
    try {
      // Anthropic doesn't have a health endpoint, so make a minimal request
      await this.api.post('/v1/messages', {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      });
      return true;
    } catch (error: unknown) {
      // 401 means auth failed but server is reachable
      if (error && typeof error === 'object' && 'code' in error) {
        return (error as { code: string }).code === 'HTTP_401' ? false : true;
      }
      return false;
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    return ANTHROPIC_MODELS;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    await this.waitForRateLimit();

    const body = this.buildRequestBody(request, false);
    const data = await this.api.post<AnthropicResponse>('/v1/messages', body);

    const textParts = data.content.filter((c) => c.type === 'text');
    const toolParts = data.content.filter((c) => c.type === 'tool_use');

    return {
      content: textParts.map((p) => p.text).join(''),
      toolCalls: toolParts.length
        ? toolParts.map((tc) => ({
            id: tc.id!,
            name: tc.name!,
            arguments: tc.input!,
          }))
        : undefined,
      finishReason: data.stop_reason === 'tool_use' ? 'tool_calls' : 'stop',
      model: data.model,
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      },
    };
  }

  async *stream(request: CompletionRequest): AsyncIterable<StreamChunk> {
    await this.waitForRateLimit();

    const body = this.buildRequestBody(request, true);
    const parser = new StreamParser('sse');
    let inputTokens = 0;
    let outputTokens = 0;

    for await (const raw of this.streamClient.stream(
      `${this.config.baseUrl}/v1/messages`,
      body,
      this.getAuthHeaders(),
    )) {
      for (const jsonStr of parser.parse(raw)) {
        try {
          const event = JSON.parse(jsonStr) as AnthropicStreamEvent;

          switch (event.type) {
            case 'message_start':
              if (event.message?.usage) {
                inputTokens = event.message.usage.input_tokens;
              }
              break;

            case 'content_block_start':
              if (event.content_block?.type === 'tool_use') {
                yield {
                  type: 'tool_call_start',
                  toolCall: {
                    id: event.content_block.id,
                    name: event.content_block.name,
                  },
                  toolCallIndex: event.index,
                };
              }
              break;

            case 'content_block_delta':
              if (event.delta?.type === 'text_delta' && event.delta.text) {
                yield { type: 'text', text: event.delta.text };
              } else if (event.delta?.type === 'input_json_delta') {
                yield {
                  type: 'tool_call_delta',
                  toolCallIndex: event.index,
                };
              }
              break;

            case 'content_block_stop':
              if (event.index !== undefined) {
                yield { type: 'tool_call_end', toolCallIndex: event.index };
              }
              break;

            case 'message_delta':
              if (event.usage) {
                outputTokens = event.usage.output_tokens;
              }
              if (event.delta?.stop_reason) {
                yield {
                  type: 'usage',
                  usage: {
                    promptTokens: inputTokens,
                    completionTokens: outputTokens,
                    totalTokens: inputTokens + outputTokens,
                  },
                };
                yield { type: 'done' };
              }
              break;
          }
        } catch {
          // Skip malformed events
        }
      }
    }
  }

  private buildRequestBody(request: CompletionRequest, stream: boolean) {
    // Anthropic uses system as a top-level param, not a message
    const systemMessages = request.messages.filter((m) => m.role === 'system');
    const nonSystemMessages = request.messages.filter((m) => m.role !== 'system');

    const messages = nonSystemMessages.map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: m.toolCallId,
              content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
            },
          ],
        };
      }

      if (m.role === 'assistant' && m.toolCalls?.length) {
        const content: unknown[] = [];
        if (typeof m.content === 'string' && m.content) {
          content.push({ type: 'text', text: m.content });
        }
        for (const tc of m.toolCalls) {
          content.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: tc.arguments,
          });
        }
        return { role: 'assistant', content };
      }

      return {
        role: m.role,
        content: typeof m.content === 'string'
          ? m.content
          : m.content.map((p) =>
              p.type === 'image'
                ? {
                    type: 'image',
                    source: {
                      type: 'base64',
                      media_type: p.mimeType ?? 'image/png',
                      data: p.imageBase64,
                    },
                  }
                : { type: 'text', text: p.text },
            ),
      };
    });

    const body: Record<string, unknown> = {
      model: request.model,
      messages,
      max_tokens: request.maxTokens ?? this.config.maxTokens ?? 4096,
      stream,
    };

    if (request.temperature !== undefined) {
      body.temperature = request.temperature;
    }

    if (systemMessages.length > 0) {
      body.system = systemMessages
        .map((m) => (typeof m.content === 'string' ? m.content : ''))
        .join('\n');
    }

    if (request.tools?.length) {
      body.tools = request.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema,
      }));
    }

    return body;
  }
}
