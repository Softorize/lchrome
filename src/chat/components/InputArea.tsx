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
    const maxHeight = lineHeight * 6 + 24;
    const scrollHeight = textarea.scrollHeight;
    textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
  }, [input]);

  const handleSend = useCallback(() => {
    if (!input.trim() || disabled) return;
    onSend(input.trim());
    setInput('');
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

  return (
    <div
      style={{
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-secondary)',
        padding: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled
              ? 'Select a provider and model to start...'
              : 'Type a message... (Shift+Enter for new line)'
          }
          disabled={disabled || isLoading}
          rows={2}
          style={{
            flex: 1,
            resize: 'none',
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '12px 16px',
            fontSize: '14px',
            lineHeight: '22px',
            color: 'var(--text-primary)',
            outline: 'none',
            minHeight: '52px',
            fontFamily: 'inherit',
            opacity: disabled ? 0.5 : 1,
          }}
        />

        {isLoading ? (
          <button
            onClick={onStop}
            style={{
              flexShrink: 0,
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '10px',
              background: 'var(--error)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
            }}
            title="Stop generation"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <rect x="6" y="6" width="8" height="8" rx="1" />
            </svg>
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!input.trim() || disabled}
            style={{
              flexShrink: 0,
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '10px',
              background: !input.trim() || disabled ? 'var(--border)' : 'var(--accent)',
              color: 'white',
              border: 'none',
              cursor: !input.trim() || disabled ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
            }}
            title="Send message"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
