import React, { useState, useRef, useEffect } from 'react';
import { useProvider } from '../hooks/useProvider';

export function ModelSelector() {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const {
    providers,
    activeProvider,
    activeModel,
    models,
    selectProvider,
    selectModel,
  } = useProvider();

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const enabledProviders = providers.filter((p) => p.enabled);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1 rounded text-xs bg-[var(--bg-primary)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors min-w-0"
      >
        <span className="truncate max-w-[140px] text-[var(--text-secondary)]">
          {activeProvider
            ? `${activeProvider.name} / ${activeModel?.name ?? activeModel?.id ?? 'Select model'}`
            : 'Select provider'}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          fill="currentColor"
          className={`w-3 h-3 text-[var(--text-muted)] transition-transform shrink-0 ${open ? 'rotate-180' : ''}`}
        >
          <path
            fillRule="evenodd"
            d="M4.22 6.22a.75.75 0 011.06 0L8 8.94l2.72-2.72a.75.75 0 111.06 1.06l-3.25 3.25a.75.75 0 01-1.06 0L4.22 7.28a.75.75 0 010-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-64 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg shadow-lg overflow-hidden">
          {enabledProviders.length === 0 ? (
            <div className="px-3 py-4 text-xs text-[var(--text-muted)] text-center">
              No providers configured. Open settings to add one.
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {enabledProviders.map((provider) => (
                <div key={provider.id}>
                  {/* Provider header */}
                  <button
                    onClick={() => selectProvider(provider.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-medium border-b border-[var(--border)] hover:bg-[var(--bg-tertiary)] transition-colors ${
                      activeProvider?.id === provider.id
                        ? 'text-[var(--accent)] bg-[var(--bg-tertiary)]/50'
                        : 'text-[var(--text-primary)]'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        activeProvider?.id === provider.id
                          ? 'bg-[var(--accent)]'
                          : 'bg-[var(--text-muted)]'
                      }`}
                    />
                    <span className="truncate">{provider.name}</span>
                    <span className="text-[10px] text-[var(--text-muted)] ml-auto">
                      {provider.type}
                    </span>
                  </button>

                  {/* Models for active provider */}
                  {activeProvider?.id === provider.id && models.length > 0 && (
                    <div className="bg-[var(--bg-primary)]/50">
                      {models.map((model) => (
                        <button
                          key={model.id}
                          onClick={() => {
                            selectModel(model.id);
                            setOpen(false);
                          }}
                          className={`w-full flex items-center gap-2 px-5 py-1.5 text-left text-xs hover:bg-[var(--bg-tertiary)] transition-colors ${
                            activeModel?.id === model.id
                              ? 'text-[var(--accent)]'
                              : 'text-[var(--text-secondary)]'
                          }`}
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
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
