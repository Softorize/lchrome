import { BaseProvider } from '@/providers/base/BaseProvider';
import type {
  ModelInfo,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
} from '@/types/ai-provider';
import { StreamParser } from '@/providers/streaming/StreamParser';

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text?: string;
        functionCall?: { name: string; args: Record<string, unknown> };
      }>;
    };
    finishReason: string;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

const GEMINI_MODELS: ModelInfo[] = [
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'google', supportsTools: true, supportsStreaming: true, supportsVision: true },
  { id: 'gemini-2.0-pro', name: 'Gemini 2.0 Pro', provider: 'google', supportsTools: true, supportsStreaming: true, supportsVision: true },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'google', supportsTools: true, supportsStreaming: true, supportsVision: true },
];

export class GoogleProvider extends BaseProvider {
  private get apiKeyParam(): string {
    return this.config.apiKey ? `?key=${this.config.apiKey}` : '';
  }

  async ping(): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.config.baseUrl}/v1beta/models${this.apiKeyParam}`,
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const response = await fetch(
        `${this.config.baseUrl}/v1beta/models${this.apiKeyParam}`,
      );
      if (!response.ok) return GEMINI_MODELS;
      const data = await response.json();
      return (data.models ?? [])
        .filter((m: { name: string }) => m.name.includes('gemini'))
        .map((m: { name: string; displayName: string }) => ({
          id: m.name.replace('models/', ''),
          name: m.displayName,
          provider: 'google' as const,
          supportsTools: true,
          supportsStreaming: true,
        }));
    } catch {
      return GEMINI_MODELS;
    }
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    await this.waitForRateLimit();

    const body = this.buildRequestBody(request);
    const url = `${this.config.baseUrl}/v1beta/models/${request.model}:generateContent${this.apiKeyParam}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Google API error: ${response.status}`);
    }

    const data = (await response.json()) as GeminiResponse;
    const candidate = data.candidates[0];
    const textParts = candidate.content.parts.filter((p) => p.text);
    const toolParts = candidate.content.parts.filter((p) => p.functionCall);

    return {
      content: textParts.map((p) => p.text!).join(''),
      toolCalls: toolParts.length
        ? toolParts.map((tc) => ({
            id: `call_${crypto.randomUUID().slice(0, 8)}`,
            name: tc.functionCall!.name,
            arguments: tc.functionCall!.args,
          }))
        : undefined,
      finishReason: toolParts.length ? 'tool_calls' : 'stop',
      model: request.model,
      usage: data.usageMetadata
        ? {
            promptTokens: data.usageMetadata.promptTokenCount,
            completionTokens: data.usageMetadata.candidatesTokenCount,
            totalTokens: data.usageMetadata.totalTokenCount,
          }
        : undefined,
    };
  }

  async *stream(request: CompletionRequest): AsyncIterable<StreamChunk> {
    await this.waitForRateLimit();

    const body = this.buildRequestBody(request);
    const url = `${this.config.baseUrl}/v1beta/models/${request.model}:streamGenerateContent?alt=sse${this.config.apiKey ? `&key=${this.config.apiKey}` : ''}`;
    const parser = new StreamParser('sse');

    for await (const raw of this.streamClient.stream(url, body, {})) {
      for (const jsonStr of parser.parse(raw)) {
        try {
          const chunk = JSON.parse(jsonStr) as GeminiResponse;
          const candidate = chunk.candidates?.[0];
          if (!candidate) continue;

          for (const part of candidate.content.parts) {
            if (part.text) {
              yield { type: 'text', text: part.text };
            }
            if (part.functionCall) {
              yield {
                type: 'tool_call_start',
                toolCall: {
                  id: `call_${crypto.randomUUID().slice(0, 8)}`,
                  name: part.functionCall.name,
                  arguments: part.functionCall.args,
                },
              };
              yield { type: 'tool_call_end' };
            }
          }

          if (chunk.usageMetadata) {
            yield {
              type: 'usage',
              usage: {
                promptTokens: chunk.usageMetadata.promptTokenCount,
                completionTokens: chunk.usageMetadata.candidatesTokenCount,
                totalTokens: chunk.usageMetadata.totalTokenCount,
              },
            };
          }

          if (candidate.finishReason === 'STOP') {
            yield { type: 'done' };
          }
        } catch {
          // Skip
        }
      }
    }
  }

  private buildRequestBody(request: CompletionRequest) {
    const systemInstruction = request.messages
      .filter((m) => m.role === 'system')
      .map((m) => (typeof m.content === 'string' ? m.content : ''))
      .join('\n');

    const contents = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts:
          typeof m.content === 'string'
            ? [{ text: m.content }]
            : m.content.map((p) =>
                p.type === 'image'
                  ? {
                      inline_data: {
                        mime_type: p.mimeType ?? 'image/png',
                        data: p.imageBase64,
                      },
                    }
                  : { text: p.text ?? '' },
              ),
      }));

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: request.temperature ?? this.config.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens ?? this.config.maxTokens ?? 4096,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    if (request.tools?.length) {
      body.tools = [
        {
          functionDeclarations: request.tools.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.inputSchema,
          })),
        },
      ];
    }

    return body;
  }
}
