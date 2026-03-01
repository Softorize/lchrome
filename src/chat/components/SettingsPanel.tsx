import React, { useEffect, useRef, useCallback } from 'react';
import { ProviderConfig } from './ProviderConfig';
import { useProvider } from '../hooks/useProvider';
import { useSettingsStore } from '../store/settingsSlice';
import type { ProviderConfig as ProviderConfigType, ProviderType } from '@/types/ai-provider';

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { providers, addProvider, updateProvider, removeProvider } = useProvider();
  const settings = useSettingsStore();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus trap
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    // Focus the close button on open
    closeButtonRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key !== 'Tab' || !panel) return;

      const focusableElements = panel.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      const focusable = Array.from(focusableElements).filter(
        (el) => !el.hasAttribute('disabled') && el.offsetParent !== null,
      );

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleAddProvider = useCallback(() => {
    const newProvider: ProviderConfigType = {
      id: crypto.randomUUID(),
      type: 'ollama' as ProviderType,
      name: 'New Provider',
      baseUrl: 'http://localhost:11434',
      enabled: true,
    };
    addProvider(newProvider);
    persistProviders([...providers, newProvider]);
  }, [addProvider, providers]);

  const handleUpdateProvider = useCallback(
    (id: string, updates: Partial<ProviderConfigType>) => {
      updateProvider(id, updates);
      const updated = providers.map((p) => (p.id === id ? { ...p, ...updates } : p));
      persistProviders(updated);
    },
    [updateProvider, providers],
  );

  const handleRemoveProvider = useCallback(
    (id: string) => {
      removeProvider(id);
      const filtered = providers.filter((p) => p.id !== id);
      persistProviders(filtered);
    },
    [removeProvider, providers],
  );

  const persistProviders = (list: ProviderConfigType[]) => {
    chrome.storage.local.set({ providers: list });
  };

  const handleSettingsChange = useCallback(
    (updates: Partial<typeof settings>) => {
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
    },
    [settings],
  );

  return (
    <div
      className="absolute inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      ref={panelRef}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel - full width since we're in a sidebar */}
      <div className="absolute inset-0 bg-[var(--bg-primary)] flex flex-col z-10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-secondary)] shrink-0">
          <h2 className="text-sm font-semibold">Settings</h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-150"
            aria-label="Close settings"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4"
              aria-hidden="true"
            >
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 scroll-container">
          {/* Providers section */}
          <section aria-labelledby="providers-heading">
            <div className="flex items-center justify-between mb-3">
              <h3
                id="providers-heading"
                className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]"
              >
                Providers
              </h3>
              <button
                onClick={handleAddProvider}
                className="text-xs px-3 py-1 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors duration-150"
                aria-label="Add new provider"
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
          <section aria-labelledby="general-heading">
            <h3
              id="general-heading"
              className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3"
            >
              General
            </h3>

            <div className="space-y-4">
              {/* Theme selector */}
              <div className="flex items-center justify-between">
                <label
                  htmlFor="theme-select"
                  className="text-sm text-[var(--text-secondary)]"
                >
                  Theme
                </label>
                <select
                  id="theme-select"
                  value={settings.theme}
                  onChange={(e) =>
                    handleSettingsChange({ theme: e.target.value as 'dark' | 'light' })
                  }
                  className="text-xs px-2 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors duration-150"
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </div>

              {/* Max context messages */}
              <div className="flex items-center justify-between">
                <label
                  htmlFor="max-context"
                  className="text-sm text-[var(--text-secondary)]"
                >
                  Max context messages
                </label>
                <input
                  id="max-context"
                  type="number"
                  value={settings.maxContextMessages}
                  onChange={(e) =>
                    handleSettingsChange({
                      maxContextMessages: parseInt(e.target.value, 10) || 50,
                    })
                  }
                  min={1}
                  max={200}
                  className="w-16 text-xs px-2 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-right focus:outline-none focus:border-[var(--accent)] transition-colors duration-150"
                />
              </div>

              {/* Default max tokens */}
              <div className="flex items-center justify-between">
                <label
                  htmlFor="max-tokens"
                  className="text-sm text-[var(--text-secondary)]"
                >
                  Default max tokens
                </label>
                <input
                  id="max-tokens"
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
                  className="w-20 text-xs px-2 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-right focus:outline-none focus:border-[var(--accent)] transition-colors duration-150"
                />
              </div>

              {/* Default temperature */}
              <div className="flex items-center justify-between">
                <label
                  htmlFor="temperature"
                  className="text-sm text-[var(--text-secondary)]"
                >
                  Default temperature
                </label>
                <input
                  id="temperature"
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
                  className="w-16 text-xs px-2 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-right focus:outline-none focus:border-[var(--accent)] transition-colors duration-150"
                />
              </div>

              {/* MCP toggle */}
              <div className="flex items-center justify-between">
                <label
                  htmlFor="mcp-toggle"
                  className="text-sm text-[var(--text-secondary)]"
                >
                  MCP enabled
                </label>
                <button
                  id="mcp-toggle"
                  onClick={() =>
                    handleSettingsChange({ mcpEnabled: !settings.mcpEnabled })
                  }
                  role="switch"
                  aria-checked={settings.mcpEnabled}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-150 ${
                    settings.mcpEnabled ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform duration-150 ${
                      settings.mcpEnabled ? 'translate-x-[18px]' : 'translate-x-[2px]'
                    }`}
                    aria-hidden="true"
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
