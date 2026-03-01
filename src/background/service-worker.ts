import { Logger } from '@/core/logger/Logger';
import { messageBus } from '@/infrastructure/messaging/MessageBus';
import { setupMessageRouter } from './handlers/message-router';
import { setupToolHandler } from './handlers/tool-handler';
import { setupProviderHandler } from './handlers/provider-handler';
import { setupMcpHandler } from './handlers/mcp-handler';

const logger = new Logger('ServiceWorker');

logger.info('OmniChrome service worker starting...');

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    await chrome.sidePanel.open({ tabId: tab.id });
  }
});

// Enable side panel on all tabs
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
  // Fallback for older Chrome versions
});

// Setup message handlers
setupMessageRouter(messageBus);
setupToolHandler(messageBus);
setupProviderHandler(messageBus);
setupMcpHandler(messageBus);

// Keep service worker alive via periodic alarm
chrome.alarms.create('keepalive', { periodInMinutes: 0.4 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepalive') {
    logger.debug('Keepalive ping');
  }
});

logger.info('OmniChrome service worker ready');
