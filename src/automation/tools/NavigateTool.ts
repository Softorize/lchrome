import type { ITool } from './ITool';
import type { ToolSchema, ToolInput, ToolOutput, ToolContext } from '@/types/automation';
import { ToolError } from '@/core/errors/AppError';

export class NavigateTool implements ITool {
  readonly schema: ToolSchema = {
    name: 'navigate',
    description:
      'Navigate to a URL, or go forward/back in browser history. Provide a full URL, or use "back"/"forward" to navigate history.',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: {
          type: 'number',
          description: 'The ID of the tab to navigate.',
        },
        url: {
          type: 'string',
          description:
            'The URL to navigate to. Can be provided with or without protocol (defaults to https://). Use "back" to go back or "forward" to go forward in history.',
        },
      },
      required: ['tabId', 'url'],
    },
  };

  async execute(input: ToolInput, _context: ToolContext): Promise<ToolOutput> {
    const tabId = input.tabId as number;
    const url = input.url as string;

    try {
      if (url === 'back') {
        await chrome.tabs.goBack(tabId);
        // Wait briefly for navigation to start
        await this.waitForNavigation(tabId);
        const tab = await chrome.tabs.get(tabId);
        return {
          content: [
            {
              type: 'text',
              text: `Navigated back. Current URL: ${tab.url ?? 'unknown'}`,
            },
          ],
        };
      }

      if (url === 'forward') {
        await chrome.tabs.goForward(tabId);
        await this.waitForNavigation(tabId);
        const tab = await chrome.tabs.get(tabId);
        return {
          content: [
            {
              type: 'text',
              text: `Navigated forward. Current URL: ${tab.url ?? 'unknown'}`,
            },
          ],
        };
      }

      // Normalize the URL: add https:// if no protocol is provided
      let normalizedUrl = url;
      if (!/^[a-zA-Z]+:\/\//.test(normalizedUrl)) {
        normalizedUrl = `https://${normalizedUrl}`;
      }

      await chrome.tabs.update(tabId, { url: normalizedUrl });
      await this.waitForNavigation(tabId);

      const tab = await chrome.tabs.get(tabId);
      return {
        content: [
          {
            type: 'text',
            text: `Navigated to: ${tab.url ?? normalizedUrl}. Page title: ${tab.title ?? 'unknown'}`,
          },
        ],
      };
    } catch (error) {
      if (error instanceof ToolError) throw error;
      throw new ToolError(
        `Navigation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'navigate',
      );
    }
  }

  private waitForNavigation(tabId: number, timeoutMs = 10000): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        // Resolve even on timeout - the page might still be loading
        resolve();
      }, timeoutMs);

      const listener = (
        updatedTabId: number,
        changeInfo: chrome.tabs.TabChangeInfo,
      ) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          clearTimeout(timeout);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };

      chrome.tabs.onUpdated.addListener(listener);
    });
  }
}
