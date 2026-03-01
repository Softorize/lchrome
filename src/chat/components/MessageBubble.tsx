import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ToolCallVisualization } from './ToolCallVisualization';
import type { ChatMessageUI } from '../store/chatSlice';

interface MessageBubbleProps {
  message: ChatMessageUI;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isTool = message.role === 'tool';

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="max-w-[90%] px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] text-xs text-[var(--text-muted)] italic">
          {message.content}
        </div>
      </div>
    );
  }

  if (isTool) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] text-xs font-mono text-[var(--text-secondary)]">
          <span className="text-[var(--accent)] font-semibold text-[10px] uppercase tracking-wider">
            Tool Result
          </span>
          <pre className="mt-1 whitespace-pre-wrap break-words text-xs">
            {message.content}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
          isUser
            ? 'bg-[var(--accent)] text-white rounded-br-sm'
            : 'bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] rounded-bl-sm'
        }`}
      >
        {/* Message content */}
        {message.content && (
          <div className="message-content">
            {isUser ? (
              <p className="whitespace-pre-wrap">{message.content}</p>
            ) : (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            )}
          </div>
        )}

        {/* Tool calls */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-2 space-y-2">
            {message.toolCalls.map((toolCall) => (
              <ToolCallVisualization key={toolCall.id} toolCall={toolCall} />
            ))}
          </div>
        )}

        {/* Metadata footer */}
        <div
          className={`flex items-center gap-2 mt-1.5 text-[10px] ${
            isUser ? 'text-white/60' : 'text-[var(--text-muted)]'
          }`}
        >
          <span>
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {message.model && <span>{message.model}</span>}
          {message.usage && (
            <span>{message.usage.totalTokens} tokens</span>
          )}
        </div>
      </div>
    </div>
  );
}
