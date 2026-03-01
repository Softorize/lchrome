import type { ITool } from './ITool';
import type { ToolSchema, ToolInput, ToolOutput, ToolContext } from '@/types/automation';
import { ToolError } from '@/core/errors/AppError';

export class TabManagementTool implements ITool {
  readonly schema: ToolSchema = {
    name: 'tab_management',
    description:
      'Manage browser tabs. Get context about the current tab group, create new tabs, or list all tabs. Use "context" to get current tab group info, "create" to open a new empty tab, or "list" to see all tabs.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description:
            'The tab management action: "context" to get current tab group info, "create" to create a new empty tab, "list" to list all tabs.',
          enum: ['context', 'create', 'list'],
        },
        tabId: {
          type: 'number',
          description:
            'Optional tab ID. Used with "context" to get info about a specific tab\'s group.',
        },
      },
      required: ['action'],
    },
  };

  async execute(input: ToolInput, _context: ToolContext): Promise<ToolOutput> {
    const action = input.action as string;
    const tabId = input.tabId as number | undefined;

    try {
      switch (action) {
        case 'context':
          return this.getContext(tabId);
        case 'create':
          return this.createTab();
        case 'list':
          return this.listTabs();
        default:
          throw new ToolError(`Unknown tab management action: ${action}`, 'tab_management');
      }
    } catch (error) {
      if (error instanceof ToolError) throw error;
      throw new ToolError(
        `Tab management action "${action}" failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'tab_management',
      );
    }
  }

  private async getContext(tabId?: number): Promise<ToolOutput> {
    if (tabId) {
      const tab = await chrome.tabs.get(tabId);
      const groupInfo = tab.groupId !== -1
        ? await this.getGroupInfo(tab.groupId)
        : null;

      const tabInfo = this.formatTab(tab);
      let text = `Tab context:\n${tabInfo}`;

      if (groupInfo) {
        text += `\nGroup: ${groupInfo.title ?? 'Untitled'} (id: ${groupInfo.id})`;

        // Get all tabs in the same group
        const groupTabs = await chrome.tabs.query({ groupId: tab.groupId });
        text += `\nTabs in group (${groupTabs.length}):`;
        for (const gt of groupTabs) {
          text += `\n  ${this.formatTab(gt)}`;
        }
      }

      return {
        content: [{ type: 'text', text }],
      };
    }

    // No tabId: return info about the current/active tab
    const [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!activeTab) {
      return {
        content: [
          {
            type: 'text',
            text: 'No active tab found in the current window.',
          },
        ],
      };
    }

    const tabInfo = this.formatTab(activeTab);
    return {
      content: [
        {
          type: 'text',
          text: `Active tab:\n${tabInfo}`,
        },
      ],
    };
  }

  private async createTab(): Promise<ToolOutput> {
    const tab = await chrome.tabs.create({ active: true });

    return {
      content: [
        {
          type: 'text',
          text: `Created new tab with ID: ${tab.id}`,
        },
      ],
    };
  }

  private async listTabs(): Promise<ToolOutput> {
    const tabs = await chrome.tabs.query({});

    if (tabs.length === 0) {
      return {
        content: [{ type: 'text', text: 'No tabs found.' }],
      };
    }

    // Group tabs by window
    const byWindow = new Map<number, chrome.tabs.Tab[]>();
    for (const tab of tabs) {
      const windowId = tab.windowId;
      if (!byWindow.has(windowId)) {
        byWindow.set(windowId, []);
      }
      byWindow.get(windowId)!.push(tab);
    }

    let text = `Total tabs: ${tabs.length}\n`;

    for (const [windowId, windowTabs] of byWindow) {
      text += `\nWindow ${windowId} (${windowTabs.length} tabs):`;
      for (const tab of windowTabs) {
        const active = tab.active ? ' [ACTIVE]' : '';
        const group =
          tab.groupId !== -1 ? ` (group: ${tab.groupId})` : '';
        text += `\n  [${tab.id}]${active}${group} ${tab.title ?? 'Untitled'} - ${tab.url ?? 'about:blank'}`;
      }
    }

    return {
      content: [{ type: 'text', text }],
    };
  }

  private formatTab(tab: chrome.tabs.Tab): string {
    const parts = [`[${tab.id}]`];
    if (tab.active) parts.push('[ACTIVE]');
    parts.push(tab.title ?? 'Untitled');
    parts.push('-');
    parts.push(tab.url ?? 'about:blank');
    if (tab.groupId !== -1) parts.push(`(group: ${tab.groupId})`);
    return parts.join(' ');
  }

  private async getGroupInfo(
    groupId: number,
  ): Promise<chrome.tabGroups.TabGroup | null> {
    try {
      return await chrome.tabGroups.get(groupId);
    } catch {
      return null;
    }
  }
}
