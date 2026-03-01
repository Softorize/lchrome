import { Logger } from '@/core/logger/Logger';

interface TabContext {
  tabId: number;
  groupId?: number;
  url?: string;
  title?: string;
}

export class TabGroupService {
  private logger = new Logger('TabGroupService');
  private tabGroups = new Map<number, Set<number>>(); // groupId -> Set<tabId>

  async getTabContext(tabId: number): Promise<TabContext | null> {
    try {
      const tab = await chrome.tabs.get(tabId);
      return {
        tabId: tab.id!,
        groupId: tab.groupId !== -1 ? tab.groupId : undefined,
        url: tab.url,
        title: tab.title,
      };
    } catch {
      return null;
    }
  }

  async getGroupTabs(groupId: number): Promise<TabContext[]> {
    const tabs = await chrome.tabs.query({ groupId });
    return tabs.map((tab) => ({
      tabId: tab.id!,
      groupId: tab.groupId !== -1 ? tab.groupId : undefined,
      url: tab.url,
      title: tab.title,
    }));
  }

  async createTab(groupId?: number): Promise<TabContext> {
    const tab = await chrome.tabs.create({ active: false });

    if (groupId && tab.id) {
      try {
        await chrome.tabs.group({ tabIds: tab.id, groupId });
      } catch {
        this.logger.warn(`Failed to add tab to group ${groupId}`);
      }
    }

    return {
      tabId: tab.id!,
      groupId: tab.groupId !== -1 ? tab.groupId : undefined,
      url: tab.url,
      title: tab.title,
    };
  }

  async getAllTabs(): Promise<TabContext[]> {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    return tabs.map((tab) => ({
      tabId: tab.id!,
      groupId: tab.groupId !== -1 ? tab.groupId : undefined,
      url: tab.url,
      title: tab.title,
    }));
  }
}
