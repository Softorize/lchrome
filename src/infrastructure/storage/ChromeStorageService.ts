import { Logger } from '@/core/logger/Logger';

export class ChromeStorageService {
  private logger = new Logger('ChromeStorage');

  async get<T>(key: string): Promise<T | null> {
    try {
      const result = await chrome.storage.local.get(key);
      return (result[key] as T) ?? null;
    } catch (error) {
      this.logger.error(`Failed to get key: ${key}`, error);
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      await chrome.storage.local.set({ [key]: value });
    } catch (error) {
      this.logger.error(`Failed to set key: ${key}`, error);
      throw error;
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await chrome.storage.local.remove(key);
    } catch (error) {
      this.logger.error(`Failed to remove key: ${key}`, error);
      throw error;
    }
  }

  async getAll(): Promise<Record<string, unknown>> {
    return chrome.storage.local.get(null);
  }

  async clear(): Promise<void> {
    await chrome.storage.local.clear();
  }

  onChanged(callback: (changes: Record<string, chrome.storage.StorageChange>) => void): void {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        callback(changes);
      }
    });
  }
}
