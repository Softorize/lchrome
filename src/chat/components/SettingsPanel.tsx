import React from 'react';
import { ProviderConfig } from './ProviderConfig';
import { useProvider } from '../hooks/useProvider';
import { useSettingsStore } from '../store/settingsSlice';
import type { ProviderType, ProviderConfig as ProviderConfigType } from '@/types/ai-provider';

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { providers, addProvider, updateProvider, removeProvider } = useProvider();
  const settings = useSettingsStore();

  const handleAddProvider = () => {
    const newProvider: ProviderConfigType = {
      id: crypto.randomUUID(),
      type: 'ollama' as ProviderType,
      name: 'New Provider',
      baseUrl: 'http://localhost:11434',
      enabled: true,
    };
    addProvider(newProvider);
    persistProviders([...providers, newProvider]);
  };

  const handleUpdateProvider = (id: string, updates: Partial<ProviderConfigType>) => {
    updateProvider(id, updates);
    const updated = providers.map((p) => (p.id === id ? { ...p, ...updates } : p));
    persistProviders(updated);
  };

  const handleRemoveProvider = (id: string) => {
    removeProvider(id);
    const filtered = providers.filter((p) => p.id !== id);
    persistProviders(filtered);
  };

  const persistProviders = (list: ProviderConfigType[]) => {
    chrome.storage.local.set({ providers: list });
  };

  const handleSettingsChange = (updates: Partial<typeof settings>) => {
    settings.updateSettings(updates);
    chrome.storage.local.set({
      chatSettings: {
        theme: updates.theme ?? settings.theme,
        maxContextMessages: updates.maxContextMessages ?? settings.maxContextMessages,
        defaultMaxTokens: updates.defaultMaxTokens ?? settings.defaultMaxTokens,
        defaultTemperature: updates.defaultTemperature ?? settings.defaultTemperature,
        mcpEnabled: updates.mcpEnabled ?? settings.mcpEnabled,
      },
    });
  };

  return (
    <div className="absolute inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-sm bg-[var(--bg-primary)] border-l border-[var(--border)] flex flex-col z-10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-secondary)] shrink-0">
          <h2 className="text-sm font-semibold">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {/* Providers section */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Providers
              </h3>
              <button
                onClick={handleAddProvider}
                className="text-xs px-2 py-1 rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors"
              >
                + Add
              </button>
            </div>

            <div className="space-y-3">
              {providers.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] text-center py-4">
                  No providers configured. Click &quot;+ Add&quot; to get started.
                </p>
              ) : (
                providers.map((provider) => (
                  <ProviderConfig
                    key={provider.id}
                    provider={provider}
                    onUpdate={(updates) => handleUpdateProvider(provider.id, updates)}
                    onRemove={() => handleRemoveProvider(provider.id)}
                  />
                ))
              )}
            </div>
          </section>

          {/* General settings */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
              General
            </h3>

            <div className="space-y-3">
              {/* Theme toggle */}
              <div className="flex items-center justify-between">
                <label className="text-sm text-[var(--text-secondary)]">Theme</label>
                <select
                  value={settings.theme}
                  onChange={(e) =>
                    handleSettingsChange({ theme: e.target.value as 'dark' | 'light' })
                  }
                  className="text-xs px-2 py-1 rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </div>

              {/* Max context messages */}
              <div className="flex items-center justify-between">
                <label className="text-sm text-[var(--text-secondary)]">
                  Max context messages
                </label>
                <input
                  type="number"
                  value={settings.maxContextMessages}
                  onChange={(e) =>
                    handleSettingsChange({
                      maxContextMessages: parseInt(e.target.value, 10) || 50,
                    })
                  }
                  min={1}
                  max={200}
                  className="w-16 text-xs px-2 py-1 rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-right focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              {/* Default max tokens */}
              <div className="flex items-center justify-between">
                <label className="text-sm text-[var(--text-secondary)]">
                  Default max tokens
                </label>
                <input
                  type="number"
                  value={settings.defaultMaxTokens}
                  onChange={(e) =>
                    handleSettingsChange({
                      defaultMaxTokens: parseInt(e.target.value, 10) || 4096,
                    })
                  }
                  min={256}
                  max={128000}
                  step={256}
                  className="w-20 text-xs px-2 py-1 rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-right focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              {/* Default temperature */}
              <div className="flex items-center justify-between">
                <label className="text-sm text-[var(--text-secondary)]">
                  Default temperature
                </label>
                <input
                  type="number"
                  value={settings.defaultTemperature}
                  onChange={(e) =>
                    handleSettingsChange({
                      defaultTemperature: parseFloat(e.target.value) || 0.7,
                    })
                  }
                  min={0}
                  max={2}
                  step={0.1}
                  className="w-16 text-xs px-2 py-1 rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-right focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              {/* MCP enabled */}
              <div className="flex items-center justify-between">
                <label className="text-sm text-[var(--text-secondary)]">
                  MCP enabled
                </label>
                <button
                  onClick={() =>
                    handleSettingsChange({ mcpEnabled: !settings.mcpEnabled })
                  }
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    settings.mcpEnabled ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                      settings.mcpEnabled ? 'translate-x-4.5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
