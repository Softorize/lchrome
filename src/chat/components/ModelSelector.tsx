import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useProvider } from '../hooks/useProvider';

export function ModelSelector() {
  const [open, setOpen] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [expandedProviderId, setExpandedProviderId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const {
    providers,
    activeProvider,
    activeModel,
    models,
    selectProvider,
    selectModel,
    refreshModels,
  } = useProvider();

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // Set expanded provider when dropdown opens
  useEffect(() => {
    if (open && activeProvider) {
      setExpandedProviderId(activeProvider.id);
    }
  }, [open, activeProvider]);

  const enabledProviders = providers.filter((p) => p.enabled);

  const handleProviderClick = useCallback(
    async (providerId: string) => {
      if (expandedProviderId === providerId) {
        // Already expanded, collapse it
        setExpandedProviderId(null);
        return;
      }

      setExpandedProviderId(providerId);
      setLoadingModels(true);

      try {
        await selectProvider(providerId);
      } finally {
        setLoadingModels(false);
      }
    },
    [expandedProviderId, selectProvider],
  );

  const handleModelClick = useCallback(
    (modelId: string) => {
      selectModel(modelId);
      setOpen(false);
    },
    [selectModel],
  );

  const handleRetry = useCallback(async () => {
    setLoadingModels(true);
    try {
      await refreshModels();
    } finally {
      setLoadingModels(false);
    }
  }, [refreshModels]);

  const displayName = activeProvider
    ? activeModel?.name ?? activeModel?.id ?? 'Select model'
    : 'Select provider';

  return (
    <div className="relative min-w-0 flex-1" ref={dropdownRef}>
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 w-full px-2 py-1 rounded-lg text-xs bg-[var(--bg-primary)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors duration-150 min-w-0"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Model selector: ${displayName}`}
      >
        {activeProvider && (
          <span
            className="w-2 h-2 rounded-full shrink-0 bg-[var(--success)]"
            aria-hidden="true"
          />
        )}
        <span className="truncate text-[var(--text-secondary)]">
          {displayName}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          fill="currentColor"
          className={`w-3 h-3 text-[var(--text-muted)] transition-transform duration-150 shrink-0 ml-auto ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M4.22 6.22a.75.75 0 011.06 0L8 8.94l2.72-2.72a.75.75 0 111.06 1.06l-3.25 3.25a.75.75 0 01-1.06 0L4.22 7.28a.75.75 0 010-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div
          className="absolute top-full left-0 right-0 mt-1 z-50 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg shadow-lg overflow-hidden"
          role="listbox"
          aria-label="Select a model"
        >
          {enabledProviders.length === 0 ? (
            <div className="px-3 py-4 text-xs text-[var(--text-muted)] text-center">
              No providers configured.
              <br />
              Open settings to add one.
            </div>
          ) : (
            <div className="max-h-[300px] overflow-y-auto scroll-container">
              {enabledProviders.map((provider) => {
                const isExpanded = expandedProviderId === provider.id;
                const isActive = activeProvider?.id === provider.id;

                return (
                  <div key={provider.id}>
                    {/* Provider header */}
                    <button
                      onClick={() => handleProviderClick(provider.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-medium border-b border-[var(--border)] hover:bg-[var(--bg-tertiary)] transition-colors duration-150 ${
                        isActive
                          ? 'text-[var(--accent)]'
                          : 'text-[var(--text-primary)]'
                      }`}
                      aria-expanded={isExpanded}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        className={`w-3 h-3 text-[var(--text-muted)] transition-transform duration-150 shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
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
                          isActive ? 'bg-[var(--accent)]' : 'bg-[var(--text-muted)]'
                        }`}
                        aria-hidden="true"
                      />
                      <span className="truncate">{provider.name}</span>
                      <span className="text-[11px] text-[var(--text-muted)] ml-auto shrink-0">
                        {provider.type}
                      </span>
                    </button>

                    {/* Models list for expanded provider */}
                    {isExpanded && (
                      <div className="bg-[var(--bg-primary)]">
                        {loadingModels ? (
                          <div className="flex items-center justify-center gap-2 px-3 py-3">
                            <svg
                              className="w-4 h-4 animate-spin text-[var(--accent)]"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              aria-hidden="true"
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
                            <span className="text-xs text-[var(--text-muted)]">Loading models...</span>
                          </div>
                        ) : isActive && models.length > 0 ? (
                          models.map((model) => (
                            <button
                              key={model.id}
                              onClick={() => handleModelClick(model.id)}
                              className={`w-full flex items-center gap-2 px-5 py-1.5 text-left text-xs hover:bg-[var(--bg-tertiary)] transition-colors duration-150 ${
                                activeModel?.id === model.id
                                  ? 'text-[var(--accent)]'
                                  : 'text-[var(--text-secondary)]'
                              }`}
                              role="option"
                              aria-selected={activeModel?.id === model.id}
                            >
                              <span className="truncate">{model.name || model.id}</span>
                              <div className="flex items-center gap-1 ml-auto shrink-0">
                                {model.supportsTools && (
                                  <span
                                    className="text-[9px] px-1 rounded bg-[var(--accent)]/20 text-[var(--accent)]"
                                    title="Supports tools"
                                  >
                                    T
                                  </span>
                                )}
                                {model.supportsVision && (
                                  <span
                                    className="text-[9px] px-1 rounded bg-[var(--success)]/20 text-[var(--success)]"
                                    title="Supports vision"
                                  >
                                    V
                                  </span>
                                )}
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="flex flex-col items-center gap-2 px-3 py-3">
                            <span className="text-xs text-[var(--text-muted)]">No models found</span>
                            <button
                              onClick={handleRetry}
                              className="text-xs px-3 py-1 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors duration-150"
                              aria-label="Retry fetching models"
                            >
                              Retry
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
