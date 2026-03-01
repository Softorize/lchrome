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

  const handleTypeChange = useCallback(
    (type: ProviderType) => {
      onUpdate({
        type,
        baseUrl: DEFAULT_URLS[type],
      });
    },
    [onUpdate],
  );

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] overflow-hidden">
      {/* Header - collapsible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-[var(--bg-tertiary)]/30 transition-colors duration-150"
        aria-expanded={expanded}
        aria-label={`${provider.name} provider settings`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          fill="currentColor"
          className={`w-3 h-3 text-[var(--text-muted)] transition-transform duration-150 shrink-0 ${expanded ? 'rotate-90' : ''}`}
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M6.22 4.22a.75.75 0 011.06 0l3.25 3.25a.75.75 0 010 1.06l-3.25 3.25a.75.75 0 01-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 010-1.06z"
            clipRule="evenodd"
          />
        </svg>
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            provider.enabled ? 'bg-[var(--success)]' : 'bg-[var(--text-muted)]'
          }`}
          aria-hidden="true"
        />
        <span className="text-sm font-medium truncate flex-1">{provider.name}</span>
        <span className="text-[11px] text-[var(--text-muted)] shrink-0 px-1.5 py-0.5 rounded bg-[var(--bg-primary)] border border-[var(--border)]">
          {provider.type}
        </span>
      </button>

      {/* Expanded form */}
      {expanded && (
        <div className="border-t border-[var(--border)] px-3 py-3 space-y-3">
          {/* Name */}
          <div>
            <label
              htmlFor={`provider-name-${provider.id}`}
              className="block text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1"
            >
              Name
            </label>
            <input
              id={`provider-name-${provider.id}`}
              type="text"
              value={provider.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              className="w-full text-xs px-2 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors duration-150"
            />
          </div>

          {/* Type */}
          <div>
            <label
              htmlFor={`provider-type-${provider.id}`}
              className="block text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1"
            >
              Type
            </label>
            <select
              id={`provider-type-${provider.id}`}
              value={provider.type}
              onChange={(e) => handleTypeChange(e.target.value as ProviderType)}
              className="w-full text-xs px-2 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors duration-150"
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
            <label
              htmlFor={`provider-url-${provider.id}`}
              className="block text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1"
            >
              Base URL
            </label>
            <input
              id={`provider-url-${provider.id}`}
              type="text"
              value={provider.baseUrl}
              onChange={(e) => onUpdate({ baseUrl: e.target.value })}
              className="w-full text-xs px-2 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] font-mono focus:outline-none focus:border-[var(--accent)] transition-colors duration-150"
            />
          </div>

          {/* API Key */}
          <div>
            <label
              htmlFor={`provider-key-${provider.id}`}
              className="block text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1"
            >
              API Key
            </label>
            <div className="flex gap-1">
              <input
                id={`provider-key-${provider.id}`}
                type={showApiKey ? 'text' : 'password'}
                value={provider.apiKey ?? ''}
                onChange={(e) => onUpdate({ apiKey: e.target.value || undefined })}
                placeholder="Optional"
                className="flex-1 text-xs px-2 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] font-mono focus:outline-none focus:border-[var(--accent)] transition-colors duration-150"
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="px-2 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs transition-colors duration-150"
                aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                title={showApiKey ? 'Hide' : 'Show'}
              >
                {showApiKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Default Model */}
          <div>
            <label
              htmlFor={`provider-model-${provider.id}`}
              className="block text-[11px] uppercase tracking-wider text-[var(--text-muted)] font-semibold mb-1"
            >
              Default Model
            </label>
            <input
              id={`provider-model-${provider.id}`}
              type="text"
              value={provider.defaultModel ?? ''}
              onChange={(e) => onUpdate({ defaultModel: e.target.value || undefined })}
              placeholder="e.g., llama3.2, gpt-4o"
              className="w-full text-xs px-2 py-1.5 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] font-mono focus:outline-none focus:border-[var(--accent)] transition-colors duration-150"
            />
          </div>

          {/* Enable/Disable toggle + action buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onUpdate({ enabled: !provider.enabled })}
                role="switch"
                aria-checked={provider.enabled}
                aria-label={provider.enabled ? 'Disable provider' : 'Enable provider'}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-150 ${
                  provider.enabled ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform duration-150 ${
                    provider.enabled ? 'translate-x-[18px]' : 'translate-x-[2px]'
                  }`}
                  aria-hidden="true"
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
                className={`text-xs px-2.5 py-1 rounded-lg transition-colors duration-150 ${
                  testResult === 'success'
                    ? 'bg-[var(--success)]/20 text-[var(--success)]'
                    : testResult === 'failure'
                      ? 'bg-[var(--error)]/20 text-[var(--error)]'
                      : 'bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                aria-label="Test provider connection"
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
                className="text-xs px-2.5 py-1 rounded-lg bg-[var(--error)]/10 text-[var(--error)] hover:bg-[var(--error)]/20 transition-colors duration-150"
                aria-label={`Remove ${provider.name} provider`}
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
