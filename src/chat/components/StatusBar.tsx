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
    <footer
      className="flex items-center justify-between px-3 border-t border-[var(--border)] bg-[var(--bg-secondary)]/50 shrink-0 select-none"
      style={{ height: '24px', fontSize: '11px' }}
      role="status"
      aria-label="Connection status"
    >
      {/* Connection status */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            connected ? 'bg-[var(--success)]' : 'bg-[var(--error)]'
          }`}
          aria-hidden="true"
        />
        <span className="text-[var(--text-muted)]">
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      {/* Active model name */}
      {activeModel && (
        <span
          className="text-[var(--text-muted)] truncate max-w-[140px] px-2"
          title={activeModel}
        >
          {activeModel}
        </span>
      )}

      {/* Token count / streaming status */}
      <div className="flex items-center gap-2 shrink-0">
        {isLoading && (
          <span className="text-[var(--accent)] animate-pulse">Streaming...</span>
        )}
        {tokenCount && !isLoading && (
          <span className="text-[var(--text-muted)]">
            {tokenCount.totalTokens.toLocaleString()} tokens
          </span>
        )}
      </div>
    </footer>
  );
}
