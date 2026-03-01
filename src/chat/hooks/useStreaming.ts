import { useCallback, useRef, useState } from 'react';
import { useChatStore } from '../store/chatSlice';
import type { ToolCallUI } from '../store/chatSlice';
import type { StreamChunk, ToolCall } from '@/types/ai-provider';

export interface StreamingState {
  isStreaming: boolean;
  messageId: string | null;
  accumulatedText: string;
  pendingToolCalls: ToolCallUI[];
}

export function useStreaming() {
  const [streamingState, setStreamingState] = useState<StreamingState>({
    isStreaming: false,
    messageId: null,
    accumulatedText: '',
    pendingToolCalls: [],
  });

  const updateMessage = useChatStore((s) => s.updateMessage);
  const abortRef = useRef<AbortSignal | null>(null);

  const startStreaming = useCallback(
    (messageId: string, signal?: AbortSignal) => {
      abortRef.current = signal ?? null;
      setStreamingState({
        isStreaming: true,
        messageId,
        accumulatedText: '',
        pendingToolCalls: [],
      });
    },
    [],
  );

  const stopStreaming = useCallback(() => {
    abortRef.current = null;
    setStreamingState({
      isStreaming: false,
      messageId: null,
      accumulatedText: '',
      pendingToolCalls: [],
    });
  }, []);

  const processChunk = useCallback(
    (chunk: StreamChunk) => {
      if (abortRef.current?.aborted) return;

      setStreamingState((prev) => {
        if (!prev.isStreaming || !prev.messageId) return prev;

        const next = { ...prev };

        switch (chunk.type) {
          case 'text': {
            if (chunk.text) {
              next.accumulatedText = prev.accumulatedText + chunk.text;
              updateMessage(prev.messageId, { content: next.accumulatedText });
            }
            break;
          }

          case 'tool_call_start': {
            if (chunk.toolCall) {
              const newCall: ToolCallUI = {
                id: chunk.toolCall.id ?? crypto.randomUUID(),
                name: chunk.toolCall.name ?? '',
                arguments: (chunk.toolCall.arguments ?? {}) as Record<string, unknown>,
                isExecuting: true,
              };
              next.pendingToolCalls = [...prev.pendingToolCalls, newCall];
              updateMessage(prev.messageId, { toolCalls: next.pendingToolCalls });
            }
            break;
          }

          case 'tool_call_delta': {
            // Tool call argument deltas are accumulated by the parser;
            // we rely on tool_call_end to finalize.
            break;
          }

          case 'tool_call_end': {
            if (chunk.toolCall && chunk.toolCallIndex !== undefined) {
              const updatedCalls = [...prev.pendingToolCalls];
              const idx = chunk.toolCallIndex;
              if (idx < updatedCalls.length) {
                updatedCalls[idx] = {
                  ...updatedCalls[idx],
                  arguments: (chunk.toolCall.arguments ?? updatedCalls[idx].arguments) as Record<
                    string,
                    unknown
                  >,
                  isExecuting: false,
                };
                next.pendingToolCalls = updatedCalls;
                updateMessage(prev.messageId, { toolCalls: updatedCalls });
              }
            }
            break;
          }

          case 'usage': {
            if (chunk.usage) {
              updateMessage(prev.messageId, {
                usage: {
                  promptTokens: chunk.usage.promptTokens,
                  completionTokens: chunk.usage.completionTokens,
                  totalTokens: chunk.usage.totalTokens,
                },
              });
            }
            break;
          }

          case 'done': {
            next.isStreaming = false;
            break;
          }

          case 'error': {
            const errorContent = prev.accumulatedText
              ? `${prev.accumulatedText}\n\n**Error:** ${chunk.error ?? 'Unknown error'}`
              : `**Error:** ${chunk.error ?? 'Unknown error'}`;
            updateMessage(prev.messageId, { content: errorContent });
            next.isStreaming = false;
            break;
          }
        }

        return next;
      });
    },
    [updateMessage],
  );

  return {
    streamingState,
    startStreaming,
    stopStreaming,
    processChunk,
  };
}
