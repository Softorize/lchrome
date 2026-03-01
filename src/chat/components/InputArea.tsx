import React, { useState, useRef, useCallback, useEffect } from 'react';

interface InputAreaProps {
  onSend: (message: string) => void;
  onStop: () => void;
  isLoading: boolean;
  disabled?: boolean;
}

export function InputArea({ onSend, onStop, isLoading, disabled }: InputAreaProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea up to 6 lines
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const lineHeight = 22;
    const padding = 24; // 12px top + 12px bottom
    const maxHeight = lineHeight * 6 + padding;
    const scrollHeight = textarea.scrollHeight;
    textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
  }, [input]);

  const handleSend = useCallback(() => {
    if (!input.trim() || disabled) return;
    onSend(input.trim());
    setInput('');

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [input, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (isLoading) return;
        handleSend();
      }
    },
    [isLoading, handleSend],
  );

  const canSend = input.trim().length > 0 && !disabled && !isLoading;

  return (
    <div
      style={{
        borderTop: '1px solid var(--border, #2a2a3e)',
        background: 'var(--bg-secondary, #1a1a2e)',
        padding: '12px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '8px',
        }}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'Select a model...' : 'Message...'}
          disabled={disabled || isLoading}
          rows={1}
          aria-label="Message input"
          style={{
            flex: 1,
            resize: 'none',
            background: 'var(--bg-primary, #0f0f1a)',
            border: '1px solid var(--border, #2a2a3e)',
            borderRadius: '12px',
            padding: '12px 16px',
            fontSize: '14px',
            lineHeight: '22px',
            color: 'var(--text-primary, #e0e0e0)',
            outline: 'none',
            minHeight: '48px',
            maxHeight: `${22 * 6 + 24}px`,
            fontFamily: 'inherit',
            opacity: disabled ? 0.5 : 1,
            transition: 'border-color 150ms ease',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent, #6366f1)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--border, #2a2a3e)';
          }}
        />

        {isLoading ? (
          <button
            onClick={onStop}
            aria-label="Stop generation"
            title="Stop generation"
            style={{
              flexShrink: 0,
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '20px',
              background: 'var(--error, #f87171)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              transition: 'opacity 150ms ease',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <rect x="5" y="5" width="10" height="10" rx="1.5" />
            </svg>
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!canSend}
            aria-label="Send message"
            title="Send message"
            style={{
              flexShrink: 0,
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '20px',
              background: canSend ? 'var(--accent, #6366f1)' : 'var(--border, #2a2a3e)',
              color: 'white',
              border: 'none',
              cursor: canSend ? 'pointer' : 'not-allowed',
              transition: 'background 150ms ease, opacity 150ms ease',
              opacity: canSend ? 1 : 0.6,
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M22 2L11 13" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
