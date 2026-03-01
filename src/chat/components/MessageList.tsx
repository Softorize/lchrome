import React, { useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import type { ChatMessageUI } from '../store/chatSlice';

interface MessageListProps {
  messages: ChatMessageUI[];
  isLoading: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages or content changes
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, messages[messages.length - 1]?.content]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] px-6 select-none">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-6 h-6 mb-3 opacity-40"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M4.848 2.771A49.144 49.144 0 0112 2.25c2.43 0 4.817.178 7.152.52 1.978.29 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.68-3.348 3.97a48.901 48.901 0 01-3.476.383.39.39 0 00-.297.17l-2.755 4.133a.75.75 0 01-1.248 0l-2.755-4.133a.39.39 0 00-.297-.17 48.9 48.9 0 01-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97z"
            clipRule="evenodd"
          />
        </svg>
        <p className="text-sm">Start a conversation</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-full overflow-y-auto px-3 py-3 space-y-3 scroll-container"
      role="log"
      aria-label="Chat messages"
      aria-live="polite"
    >
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}

      {/* Loading indicator when waiting for first token */}
      {isLoading &&
        messages.length > 0 &&
        messages[messages.length - 1]?.role === 'assistant' &&
        !messages[messages.length - 1]?.content && (
          <div className="flex items-center gap-2 px-3 py-2 text-[var(--text-muted)] text-sm" aria-label="Generating response">
            <div className="flex gap-1" aria-hidden="true">
              <span className="loading-dot w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
              <span className="loading-dot w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
              <span className="loading-dot w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
            </div>
            <span>Thinking...</span>
          </div>
        )}

      <div ref={bottomRef} aria-hidden="true" />
    </div>
  );
}
