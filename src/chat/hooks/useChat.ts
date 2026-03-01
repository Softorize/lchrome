import { useCallback, useRef } from 'react';
import { useChatStore } from '../store/chatSlice';
import { useProviderStore } from '../store/providerSlice';
import type { ChatMessageUI } from '../store/chatSlice';

export function useChat() {
  const messages = useChatStore((s) => s.messages);
  const isLoading = useChatStore((s) => s.isLoading);
  const addMessage = useChatStore((s) => s.addMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const clearMessages = useChatStore((s) => s.clearMessages);
  const setLoading = useChatStore((s) => s.setLoading);

  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      const providerId = useProviderStore.getState().activeProviderId;
      const modelId = useProviderStore.getState().activeModelId;
      const providers = useProviderStore.getState().providers;

      if (!content.trim() || !providerId || !modelId) return;

      const provider = providers.find((p) => p.id === providerId);
      if (!provider) return;

      // Add user message
      const userMessage: ChatMessageUI = {
        id: crypto.randomUUID(),
        role: 'user',
        content: content.trim(),
        timestamp: Date.now(),
      };
      addMessage(userMessage);

      // Add placeholder assistant message
      const assistantId = crypto.randomUUID();
      const assistantMessage: ChatMessageUI = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        model: modelId,
      };
      addMessage(assistantMessage);
      setLoading(true);

      abortControllerRef.current = new AbortController();

      try {
        // Build messages array for the API
        const allMessages = useChatStore.getState().messages;
        const apiMessages = allMessages
          .filter((m) => m.role === 'user' || (m.role === 'assistant' && m.content))
          .filter((m) => m.id !== assistantId)
          .map((m) => ({ role: m.role, content: m.content }));

        // Call the provider API directly
        const url = provider.type === 'ollama'
          ? `${provider.baseUrl}/api/chat`
          : `${provider.baseUrl}/v1/chat/completions`;

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (provider.apiKey && provider.type !== 'ollama') {
          if (provider.type === 'anthropic') {
            headers['x-api-key'] = provider.apiKey;
            headers['anthropic-version'] = '2023-06-01';
          } else {
            headers['Authorization'] = `Bearer ${provider.apiKey}`;
          }
        }

        let body: Record<string, unknown>;

        if (provider.type === 'ollama') {
          body = {
            model: modelId,
            messages: apiMessages,
            stream: true,
          };
        } else if (provider.type === 'anthropic') {
          const systemMsgs = apiMessages.filter((m) => m.role === 'system');
          const nonSystemMsgs = apiMessages.filter((m) => m.role !== 'system');
          body = {
            model: modelId,
            messages: nonSystemMsgs,
            max_tokens: 4096,
            stream: true,
          };
          if (systemMsgs.length > 0) {
            body.system = systemMsgs.map((m) => m.content).join('\n');
          }
        } else {
          // OpenAI-compatible
          body = {
            model: modelId,
            messages: apiMessages,
            stream: true,
          };
        }

        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new Error(`API error ${response.status}: ${errorText}`);
        }

        if (!response.body) {
          throw new Error('No response body');
        }

        // Stream the response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let reasoning = '';
        let content = '';
        let buffer = '';
        let isReasoning = false;

        const buildDisplay = () => {
          let display = '';
          if (reasoning) {
            display += `<details><summary>💭 Thinking...</summary>\n\n${reasoning}\n\n</details>\n\n`;
          }
          display += content;
          return display;
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();

            if (provider.type === 'ollama') {
              // NDJSON format
              if (!trimmed) continue;
              try {
                const chunk = JSON.parse(trimmed);
                if (chunk.message?.content) {
                  content += chunk.message.content;
                  updateMessage(assistantId, { content: buildDisplay() });
                }
              } catch { /* skip */ }
            } else {
              // SSE format
              if (!trimmed.startsWith('data: ')) continue;
              const data = trimmed.slice(6);
              if (data === '[DONE]') continue;
              try {
                const chunk = JSON.parse(data);
                const delta = chunk.choices?.[0]?.delta;

                // Handle reasoning_content (Qwen, DeepSeek, etc.)
                if (delta?.reasoning_content) {
                  reasoning += delta.reasoning_content;
                  if (!isReasoning) {
                    isReasoning = true;
                    updateMessage(assistantId, { content: '💭 *Thinking...*' });
                  }
                }

                // Handle regular content
                if (delta?.content) {
                  isReasoning = false;
                  content += delta.content;
                  updateMessage(assistantId, { content: buildDisplay() });
                }
              } catch { /* skip */ }
            }
          }
        }

        // Final update
        const finalContent = buildDisplay();
        if (finalContent) {
          updateMessage(assistantId, { content: finalContent });
        } else {
          updateMessage(assistantId, { content: '_No response from model._' });
        }
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          // User cancelled
        } else {
          const currentContent = useChatStore.getState().messages.find((m) => m.id === assistantId)?.content ?? '';
          updateMessage(assistantId, {
            content: currentContent + `\n\n**Error:** ${error instanceof Error ? error.message : 'Failed to send message'}`,
          });
        }
      } finally {
        setLoading(false);
        abortControllerRef.current = null;
      }
    },
    [addMessage, updateMessage, setLoading],
  );

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
  }, [setLoading]);

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
