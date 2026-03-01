import { useCallback, useRef } from 'react';
import { useChatStore } from '../store/chatSlice';
import { useProviderStore } from '../store/providerSlice';
import { useStreaming } from './useStreaming';
import type { ChatMessageUI } from '../store/chatSlice';
import type { ExtensionMessage, ExtensionResponse } from '@/types/messages';

export function useChat() {
  const messages = useChatStore((s) => s.messages);
  const isLoading = useChatStore((s) => s.isLoading);
  const addMessage = useChatStore((s) => s.addMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const setLoading = useChatStore((s) => s.setLoading);

  const activeProviderId = useProviderStore((s) => s.activeProviderId);
  const activeModelId = useProviderStore((s) => s.activeModelId);

  const { startStreaming, stopStreaming } = useStreaming();
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || !activeProviderId || !activeModelId) return;

      const userMessage: ChatMessageUI = {
        id: crypto.randomUUID(),
        role: 'user',
        content: content.trim(),
        timestamp: Date.now(),
      };

      addMessage(userMessage);
      setLoading(true);

      const assistantMessage: ChatMessageUI = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        model: activeModelId,
      };

      addMessage(assistantMessage);

      abortControllerRef.current = new AbortController();

      try {
        const chatMessages = useChatStore
          .getState()
          .messages.filter((m) => m.role !== 'system' || m.content)
          .map((m) => ({
            role: m.role,
            content: m.content,
            toolCalls: m.toolCalls?.map((tc) => ({
              id: tc.id,
              name: tc.name,
              arguments: tc.arguments,
            })),
          }));

        const requestPayload = {
          providerId: activeProviderId,
          request: {
            model: activeModelId,
            messages: chatMessages,
            stream: true,
          },
        };

        const message: ExtensionMessage = {
          type: 'provider:stream',
          id: crypto.randomUUID(),
          payload: requestPayload,
          source: 'sidebar',
        };

        startStreaming(assistantMessage.id, abortControllerRef.current.signal);

        const port = chrome.runtime.connect({ name: 'stream' });

        port.onMessage.addListener((streamMsg) => {
          if (streamMsg.type === 'stream:chunk' && streamMsg.chunk) {
            const chunk = streamMsg.chunk;

            if (chunk.type === 'text' && chunk.text) {
              const current = useChatStore
                .getState()
                .messages.find((m) => m.id === assistantMessage.id);
              updateMessage(assistantMessage.id, {
                content: (current?.content ?? '') + chunk.text,
              });
            }

            if (chunk.type === 'tool_call_start' && chunk.toolCall) {
              const current = useChatStore
                .getState()
                .messages.find((m) => m.id === assistantMessage.id);
              const existingCalls = current?.toolCalls ?? [];
              updateMessage(assistantMessage.id, {
                toolCalls: [
                  ...existingCalls,
                  {
                    id: chunk.toolCall.id ?? crypto.randomUUID(),
                    name: chunk.toolCall.name ?? '',
                    arguments: chunk.toolCall.arguments ?? {},
                    isExecuting: true,
                  },
                ],
              });
            }

            if (chunk.type === 'usage' && chunk.usage) {
              updateMessage(assistantMessage.id, {
                usage: {
                  promptTokens: chunk.usage.promptTokens,
                  completionTokens: chunk.usage.completionTokens,
                  totalTokens: chunk.usage.totalTokens,
                },
              });
            }
          }

          if (streamMsg.type === 'stream:done') {
            setLoading(false);
            stopStreaming();
            port.disconnect();
          }

          if (streamMsg.type === 'stream:error') {
            updateMessage(assistantMessage.id, {
              content:
                (useChatStore.getState().messages.find((m) => m.id === assistantMessage.id)
                  ?.content ?? '') + `\n\n**Error:** ${streamMsg.error ?? 'Unknown error'}`,
            });
            setLoading(false);
            stopStreaming();
            port.disconnect();
          }
        });

        port.postMessage(message);
      } catch (error) {
        updateMessage(assistantMessage.id, {
          content: `**Error:** ${error instanceof Error ? error.message : 'Failed to send message'}`,
        });
        setLoading(false);
        stopStreaming();
      }
    },
    [activeProviderId, activeModelId, addMessage, updateMessage, setLoading, startStreaming, stopStreaming],
  );

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (activeProviderId) {
      const abortMessage: ExtensionMessage = {
        type: 'provider:abort',
        id: crypto.randomUUID(),
        payload: { providerId: activeProviderId },
        source: 'sidebar',
      };
      chrome.runtime.sendMessage(abortMessage);
    }

    setLoading(false);
    stopStreaming();
  }, [activeProviderId, setLoading, stopStreaming]);

  const clearChat = useCallback(() => {
    clearMessages();
  }, [clearMessages]);

  return {
    messages,
    isLoading,
    sendMessage,
    stopGeneration,
    clearChat,
  };
}
