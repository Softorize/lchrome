import React, { useState } from 'react';
import type { ToolCallUI } from '../store/chatSlice';

interface ToolCallVisualizationProps {
  toolCall: ToolCallUI;
}

export function ToolCallVisualization({ toolCall }: ToolCallVisualizationProps) {
  const [expanded, setExpanded] = useState(false);

  const hasResult = toolCall.result !== undefined;
  const isImage =
    hasResult &&
    (toolCall.result!.startsWith('data:image/') ||
      toolCall.result!.startsWith('iVBOR') ||
      toolCall.result!.startsWith('/9j/'));

  const imageDataUrl = isImage
    ? toolCall.result!.startsWith('data:')
      ? toolCall.result!
      : `data:image/png;base64,${toolCall.result}`
    : null;

  return (
    <div
      className={`rounded-md border text-xs ${
        toolCall.isExecuting
          ? 'border-[var(--accent)] tool-executing bg-[var(--bg-primary)]/50'
          : 'border-[var(--border)] bg-[var(--bg-primary)]/30'
      }`}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-2.5 py-1.5 text-left hover:bg-[var(--bg-tertiary)]/50 rounded-t-md transition-colors"
      >
        {/* Expand/collapse icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          fill="currentColor"
          className={`w-3 h-3 text-[var(--text-muted)] transition-transform ${expanded ? 'rotate-90' : ''}`}
        >
          <path
            fillRule="evenodd"
            d="M6.22 4.22a.75.75 0 011.06 0l3.25 3.25a.75.75 0 010 1.06l-3.25 3.25a.75.75 0 01-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 010-1.06z"
            clipRule="evenodd"
          />
        </svg>

        {/* Status indicator */}
        {toolCall.isExecuting ? (
          <svg
            className="w-3 h-3 animate-spin text-[var(--accent)]"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          <span
            className={`w-2 h-2 rounded-full ${hasResult ? 'bg-[var(--success)]' : 'bg-[var(--text-muted)]'}`}
          />
        )}

        {/* Tool name */}
        <span className="font-mono font-medium text-[var(--accent)]">
          {toolCall.name}
        </span>

        {toolCall.isExecuting && (
          <span className="text-[var(--text-muted)] italic">running...</span>
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-[var(--border)] px-2.5 py-2 space-y-2">
          {/* Input arguments */}
          <div>
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
              Input
            </span>
            <pre className="mt-1 p-2 rounded bg-[var(--bg-primary)] text-[var(--text-secondary)] overflow-x-auto whitespace-pre-wrap break-words text-[11px]">
              {JSON.stringify(toolCall.arguments, null, 2)}
            </pre>
          </div>

          {/* Output / Result */}
          {hasResult && (
            <div>
              <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                Output
              </span>
              {imageDataUrl ? (
                <img
                  src={imageDataUrl}
                  alt={`Screenshot from ${toolCall.name}`}
                  className="mt-1 rounded border border-[var(--border)] max-w-full"
                />
              ) : (
                <pre className="mt-1 p-2 rounded bg-[var(--bg-primary)] text-[var(--text-secondary)] overflow-x-auto whitespace-pre-wrap break-words text-[11px] max-h-48 overflow-y-auto">
                  {toolCall.result}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
