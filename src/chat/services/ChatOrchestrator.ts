import type { ChatMessage, ToolDefinition, ToolCall, TokenUsage } from '@/types/ai-provider';
import type { ExtensionMessage, ExtensionResponse } from '@/types/messages';
import type { ToolOutput } from '@/types/automation';

export type ChatEventType =
  | 'text_chunk'
  | 'tool_calls'
  | 'tool_executing'
  | 'tool_result'
  | 'complete'
  | 'error';

export interface ChatEvent {
  type: ChatEventType;
  text?: string;
  toolCalls?: ToolCall[];
  toolCall?: ToolCall;
  toolResult?: ToolOutput;
  usage?: TokenUsage;
  error?: string;
}

async function sendToBackground<T>(
  type: ExtensionMessage['type'],
  payload: unknown,
): Promise<ExtensionResponse<T>> {
  const message: ExtensionMessage = {
    type,
    id: crypto.randomUUID(),
    payload,
    source: 'sidebar',
  };
  return chrome.runtime.sendMessage(message);
}

export class ChatOrchestrator {
  private maxToolRounds: number;

  constructor(maxToolRounds = 10) {
    this.maxToolRounds = maxToolRounds;
  }

  async *executeTurn(
    messages: ChatMessage[],
    tools: ToolDefinition[],
    providerId: string,
    modelId: string,
  ): AsyncGenerator<ChatEvent> {
    let currentMessages = [...messages];
    let round = 0;

    while (round < this.maxToolRounds) {
      round++;

      // Send completion request to the background provider
      const response = await sendToBackground<{
        content: string;
        toolCalls?: ToolCall[];
        usage?: TokenUsage;
        finishReason?: string;
      }>('provider:complete', {
        providerId,
        request: {
          model: modelId,
          messages: currentMessages,
          tools: tools.length > 0 ? tools : undefined,
        },
      });

      if (!response.success || !response.data) {
        yield {
          type: 'error',
          error: response.error?.message ?? 'Provider returned no data',
        };
        return;
      }

      const { content, toolCalls, usage } = response.data;

      // Yield text content if present
      if (content) {
        yield { type: 'text_chunk', text: content };
      }

      // If no tool calls, we are done
      if (!toolCalls || toolCalls.length === 0) {
        yield { type: 'complete', usage };
        return;
      }

      // Yield the tool calls event
      yield { type: 'tool_calls', toolCalls };

      // Append assistant message with tool calls
      currentMessages.push({
        role: 'assistant',
        content: content || '',
        toolCalls,
      });

      // Execute each tool call
      for (const toolCall of toolCalls) {
        yield { type: 'tool_executing', toolCall };

        try {
          const toolResponse = await sendToBackground<ToolOutput>('tool:execute', {
            name: toolCall.name,
            input: toolCall.arguments,
            context: { tabId: -1 },
          });

          const result: ToolOutput = toolResponse.success && toolResponse.data
            ? toolResponse.data
            : {
                content: [
                  {
                    type: 'text' as const,
                    text: toolResponse.error?.message ?? 'Tool execution failed',
                  },
                ],
                isError: true,
              };

          yield { type: 'tool_result', toolCall, toolResult: result };

          // Append tool result as a tool message
          const resultText = result.content
            .map((c) => c.text ?? (c.data ? `[${c.mimeType ?? 'binary'} data]` : ''))
            .join('\n');

          currentMessages.push({
            role: 'tool',
            content: resultText,
            toolCallId: toolCall.id,
          });
        } catch (error) {
          const errorResult: ToolOutput = {
            content: [
              {
                type: 'text',
                text: `Tool execution error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            ],
            isError: true,
          };

          yield { type: 'tool_result', toolCall, toolResult: errorResult };

          currentMessages.push({
            role: 'tool',
            content: errorResult.content[0].text ?? '',
            toolCallId: toolCall.id,
          });
        }
      }

      // Loop back to send the updated messages with tool results to the provider
    }

    yield {
      type: 'error',
      error: `Maximum tool execution rounds (${this.maxToolRounds}) exceeded`,
    };
  }
}
