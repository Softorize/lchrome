import React, { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ToolCallVisualization } from './ToolCallVisualization';
import type { ChatMessageUI } from '../store/chatSlice';

interface MessageBubbleProps {
  message: ChatMessageUI;
}

function CodeBlock({ children, className }: { children: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const language = className?.replace('language-', '') ?? '';

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not be available
    }
  }, [children]);

  return (
    <div className="relative group">
      {language && (
        <div className="flex items-center justify-between px-3 py-1 bg-[#161b22] border-b border-[var(--border)] rounded-t-md text-[11px] text-[var(--text-muted)]">
          <span>{language}</span>
        </div>
      )}
      <pre className={`${language ? '!rounded-t-none !mt-0' : ''}`}>
        <code className={className}>{children}</code>
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[10px] bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] opacity-0 group-hover:opacity-100 transition-opacity duration-150 border border-[var(--border)]"
        aria-label={copied ? 'Copied' : 'Copy code'}
        title={copied ? 'Copied!' : 'Copy'}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const [hovered, setHovered] = useState(false);
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isTool = message.role === 'tool';

  const handleCopyMessage = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not be available
    }
  }, [message.content]);

  const timestamp = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="max-w-[95%] px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] text-xs text-[var(--text-muted)] italic text-center">
          {message.content}
        </div>
      </div>
    );
  }

  if (isTool) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[95%] px-3 py-2 rounded-xl rounded-tl-sm bg-[var(--bg-tertiary)] border border-[var(--border)] text-xs font-mono text-[var(--text-secondary)]">
          <span className="text-[var(--accent)] font-semibold text-[11px] uppercase tracking-wider">
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
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="relative max-w-[95%]">
        {/* Copy button on hover */}
        {hovered && message.content && (
          <button
            onClick={handleCopyMessage}
            className={`absolute top-1 z-10 px-1.5 py-0.5 rounded text-[10px] bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border)] transition-opacity duration-150 ${
              isUser ? 'left-1' : 'right-1'
            }`}
            aria-label={copied ? 'Copied message' : 'Copy message'}
            title={copied ? 'Copied!' : 'Copy'}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}

        {/* Message bubble */}
        <div
          className={`px-3 py-2 text-sm ${
            isUser
              ? 'bg-[var(--accent)] text-white rounded-xl rounded-tr-sm'
              : 'bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] rounded-xl rounded-tl-sm'
          }`}
        >
          {/* Message content */}
          {message.content && (
            <div className="message-content">
              {isUser ? (
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
              ) : (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ children, className, ...rest }) {
                      const isInline = !className;
                      const content = String(children).replace(/\n$/, '');

                      if (isInline) {
                        return <code className={className} {...rest}>{content}</code>;
                      }

                      return <CodeBlock className={className}>{content}</CodeBlock>;
                    },
                    pre({ children }) {
                      // Let CodeBlock handle the <pre> wrapper
                      return <>{children}</>;
                    },
                  }}
                >
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

          {/* Timestamp footer */}
          <div
            className={`flex items-center gap-2 mt-1.5 text-[11px] ${
              isUser ? 'text-white/60' : 'text-[var(--text-muted)]'
            }`}
          >
            <time dateTime={new Date(message.timestamp).toISOString()}>
              {timestamp}
            </time>
            {message.model && <span>{message.model}</span>}
            {message.usage && (
              <span>{message.usage.totalTokens.toLocaleString()} tokens</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
