import React, { useState, useCallback } from 'react';
import { useProvider } from '../hooks/useProvider';
import type { ProviderConfig as ProviderConfigType, ProviderType } from '@/types/ai-provider';

interface ProviderConfigProps {
  provider: ProviderConfigType;
  onUpdate: (updates: Partial<ProviderConfigType>) => void;
  onRemove: () => void;
}

const PROVIDER_TYPES: { value: ProviderType; label: string }[] = [
  { value: 'ollama', label: 'Ollama' },
  { value: 'lmstudio', label: 'LM Studio' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google AI' },
  { value: 'openai-compat', label: 'OpenAI Compatible' },
];

const DEFAULT_URLS: Record<ProviderType, string> = {
  ollama: 'http://localhost:11434',
  lmstudio: 'http://localhost:1234',
  openai: 'https://api.openai.com',
  anthropic: 'https://api.anthropic.com',
  google: 'https://generativelanguage.googleapis.com',
  'openai-compat': 'http://localhost:8080',
};

export function ProviderConfig({ provider, onUpdate, onRemove }: ProviderConfigProps) {
  const [expanded, setExpanded] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'failure' | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  const { testConnection } = useProvider();

  const handleTestConnection = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const success = await testConnection(provider.id);
      setTestResult(success ? 'success' : 'failure');
    } catch {
      setTestResult('failure');
    } finally {
      setTesting(false);
      setTimeout(() => setTestResult(null), 3000);
    }
  }, [provider.id, testConnection]);

  const handleTypeChange = (type: ProviderType) => {
    onUpdate({
      type,
      baseUrl: DEFAULT_URLS[type],
    });
  };

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            fill="currentColor"
            className={`w-3 h-3 text-[var(--text-muted)] transition-transform shrink-0 ${expanded ? 'rotate-90' : ''}`}
          >
            <path
              fillRule="evenodd"
              d="M6.22 4.22a.75.75 0 011.06 0l3.25 3.25a.75.75 0 010 1.06l-3.25 3.25a.75.75 0 01-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 010-1.06z"
              clipRule="evenodd"
            />
          </svg>
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${provider.enabled ? 'bg-[var(--success)]' : 'bg-[var(--text-muted)]'}`}
          />
          <span className="text-sm font-medium truncate">{provider.name}</span>
          <span className="text-[10px] text-[var(--text-muted)] ml-auto shrink-0">
            {provider.type}
          </span>
        </button>
      </div>

      {/* Expanded form */}
      {expanded && (
        <div className="border-t border-[var(--border)] px-3 py-3 space-y-3">
          {/* Name */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1">
              Name
            </label>
            <input
              type="text"
              value={provider.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className="w-full text-xs px-2 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1">
              Type
            </label>
            <select
              value={provider.type}
              onChange={(e) => handleTypeChange(e.target.value as ProviderType)}
              className="w-full text-xs px-2 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
            >
              {PROVIDER_TYPES.map((pt) => (
                <option key={pt.value} value={pt.value}>
                  {pt.label}
                </option>
              ))}
            </select>
          </div>

          {/* URL */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1">
              Base URL
            </label>
            <input
              type="text"
              value={provider.baseUrl}
              onChange={(e) => onUpdate({ baseUrl: e.target.value })}
              className="w-full text-xs px-2 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] font-mono focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          {/* API Key */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1">
              API Key
            </label>
            <div className="flex gap-1">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={provider.apiKey ?? ''}
                onChange={(e) => onUpdate({ apiKey: e.target.value || undefined })}
                placeholder="Optional"
                className="flex-1 text-xs px-2 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] font-mono focus:outline-none focus:border-[var(--accent)]"
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="px-2 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs transition-colors"
                title={showApiKey ? 'Hide' : 'Show'}
              >
                {showApiKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Default Model */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1">
              Default Model
            </label>
            <input
              type="text"
              value={provider.defaultModel ?? ''}
              onChange={(e) => onUpdate({ defaultModel: e.target.value || undefined })}
              placeholder="e.g., llama3.2, gpt-4o, claude-3.5-sonnet"
              className="w-full text-xs px-2 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] font-mono focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          {/* Enable/Disable toggle + actions */}
          <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onUpdate({ enabled: !provider.enabled })}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  provider.enabled ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                    provider.enabled ? 'translate-x-4.5' : 'translate-x-0.5'
                  }`}
                />
              </button>
              <span className="text-xs text-[var(--text-secondary)]">
                {provider.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Test connection */}
              <button
                onClick={handleTestConnection}
                disabled={testing}
                className={`text-xs px-2 py-1 rounded transition-colors ${
                  testResult === 'success'
                    ? 'bg-[var(--success)]/20 text-[var(--success)]'
                    : testResult === 'failure'
                      ? 'bg-[var(--error)]/20 text-[var(--error)]'
                      : 'bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {testing
                  ? 'Testing...'
                  : testResult === 'success'
                    ? 'Connected'
                    : testResult === 'failure'
                      ? 'Failed'
                      : 'Test'}
              </button>

              {/* Remove */}
              <button
                onClick={onRemove}
                className="text-xs px-2 py-1 rounded bg-[var(--error)]/10 text-[var(--error)] hover:bg-[var(--error)]/20 transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
