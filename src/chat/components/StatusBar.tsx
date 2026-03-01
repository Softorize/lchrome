import React from 'react';
import { useChatStore } from '../store/chatSlice';

interface StatusBarProps {
  connected?: boolean;
  activeModel?: string;
}

export function StatusBar({ connected = false, activeModel }: StatusBarProps) {
  const messages = useChatStore((s) => s.messages);
  const isLoading = useChatStore((s) => s.isLoading);

  // Find the last assistant message with usage info
  const lastAssistantMessage = [...messages]
    .reverse()
    .find((m) => m.role === 'assistant' && m.usage);
  const tokenCount = lastAssistantMessage?.usage;

  return (
    <div className="flex items-center justify-between px-3 py-1 text-[10px] border-t border-[var(--border)] bg-[var(--bg-secondary)]/50 shrink-0 select-none">
      <div className="flex items-center gap-1.5">
        <span
          className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-[var(--success)]' : 'bg-[var(--error)]'}`}
        />
        <span className="text-[var(--text-muted)]">
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      {activeModel && (
        <span className="text-[var(--text-muted)] truncate max-w-[120px]">
          {activeModel}
        </span>
      )}

      <div className="flex items-center gap-2">
        {isLoading && (
          <span className="text-[var(--accent)] animate-pulse">Streaming...</span>
        )}
        {tokenCount && !isLoading && (
          <span className="text-[var(--text-muted)]">
            {tokenCount.totalTokens.toLocaleString()} tokens
          </span>
        )}
      </div>
    </div>
  );
}
