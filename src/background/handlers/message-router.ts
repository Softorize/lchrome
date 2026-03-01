import type { MessageBus } from '@/infrastructure/messaging/MessageBus';
import { Logger } from '@/core/logger/Logger';

const logger = new Logger('MessageRouter');

export function setupMessageRouter(bus: MessageBus): void {
  bus.on('settings:get', async (payload: { key: string }) => {
    const result = await chrome.storage.local.get(payload.key);
    return result[payload.key] ?? null;
  });

  bus.on('settings:set', async (payload: { key: string; value: unknown }) => {
    await chrome.storage.local.set({ [payload.key]: payload.value });
    return true;
  });

  bus.on('tab:context', async () => {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    return tabs.map((tab) => ({
      id: tab.id,
      url: tab.url,
      title: tab.title,
      active: tab.active,
      groupId: tab.groupId,
    }));
  });

  bus.on('tab:create', async () => {
    const tab = await chrome.tabs.create({ active: false });
    return { id: tab.id, url: tab.url };
  });

  logger.info('Message router initialized');
}
