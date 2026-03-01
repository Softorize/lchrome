import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

interface ProviderStatus {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
}

function Popup() {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);

  useEffect(() => {
    chrome.storage.local.get('providers').then((result) => {
      if (result.providers) {
        setProviders(result.providers);
      }
    });
  }, []);

  const openSidePanel = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.sidePanel.open({ tabId: tabs[0].id });
        window.close();
      }
    });
  };

  const openSettings = () => {
    openSidePanel();
  };

  return (
    <div>
      <div className="header">
        <h1>OmniChrome</h1>
        <span className="version">v0.1.0</span>
      </div>

      <button className="btn btn-primary" onClick={openSidePanel}>
        Open Chat Sidebar
      </button>

      <button className="btn btn-secondary" onClick={openSettings}>
        Settings
      </button>

      {providers.length > 0 && (
        <div className="provider-list">
          {providers.map((p) => (
            <div key={p.id} className="provider-item">
              <span className="name">{p.name}</span>
              <span className={`status-text ${p.enabled ? 'active' : 'inactive'}`}>
                {p.enabled ? 'Active' : 'Disabled'}
              </span>
            </div>
          ))}
        </div>
      )}

      {providers.length === 0 && (
        <div style={{ textAlign: 'center', padding: '16px 0', color: '#666', fontSize: '13px' }}>
          No providers configured.
          <br />
          Open the sidebar to get started.
        </div>
      )}
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<Popup />);
