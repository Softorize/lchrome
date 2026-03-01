import type { ConsoleMessage, NetworkRequest } from '@/types/automation';
import { Logger } from '@/core/logger/Logger';

export class DebuggerService {
  private logger = new Logger('DebuggerService');
  private attachedTabs = new Set<number>();
  private consoleMessages = new Map<number, ConsoleMessage[]>();
  private networkRequests = new Map<number, NetworkRequest[]>();

  async attach(tabId: number): Promise<void> {
    if (this.attachedTabs.has(tabId)) return;

    try {
      await chrome.debugger.attach({ tabId }, '1.3');
      this.attachedTabs.add(tabId);
      this.consoleMessages.set(tabId, []);
      this.networkRequests.set(tabId, []);

      await chrome.debugger.sendCommand({ tabId }, 'Runtime.enable');
      await chrome.debugger.sendCommand({ tabId }, 'Network.enable');

      this.logger.info(`Debugger attached to tab ${tabId}`);
    } catch (error) {
      this.logger.error(`Failed to attach debugger to tab ${tabId}`, error);
      throw error;
    }
  }

  async detach(tabId: number): Promise<void> {
    if (!this.attachedTabs.has(tabId)) return;

    try {
      await chrome.debugger.detach({ tabId });
      this.attachedTabs.delete(tabId);
      this.consoleMessages.delete(tabId);
      this.networkRequests.delete(tabId);
      this.logger.info(`Debugger detached from tab ${tabId}`);
    } catch (error) {
      this.logger.error(`Failed to detach debugger from tab ${tabId}`, error);
    }
  }

  getConsoleMessages(tabId: number, pattern?: string, limit = 100): ConsoleMessage[] {
    let messages = this.consoleMessages.get(tabId) ?? [];
    if (pattern) {
      const regex = new RegExp(pattern, 'i');
      messages = messages.filter((m) => regex.test(m.text));
    }
    return messages.slice(-limit);
  }

  getNetworkRequests(tabId: number, urlPattern?: string, limit = 100): NetworkRequest[] {
    let requests = this.networkRequests.get(tabId) ?? [];
    if (urlPattern) {
      requests = requests.filter((r) => r.url.includes(urlPattern));
    }
    return requests.slice(-limit);
  }

  clearConsole(tabId: number): void {
    this.consoleMessages.set(tabId, []);
  }

  clearNetwork(tabId: number): void {
    this.networkRequests.set(tabId, []);
  }

  isAttached(tabId: number): boolean {
    return this.attachedTabs.has(tabId);
  }

  setupEventListeners(): void {
    chrome.debugger.onEvent.addListener((source, method, params) => {
      const tabId = source.tabId;
      if (!tabId) return;

      if (method === 'Runtime.consoleAPICalled') {
        const p = params as {
          type: string;
          args: Array<{ value?: string; description?: string }>;
          timestamp: number;
        };
        const messages = this.consoleMessages.get(tabId);
        if (messages) {
          messages.push({
            type: p.type as ConsoleMessage['type'],
            text: p.args.map((a) => a.value ?? a.description ?? '').join(' '),
            timestamp: p.timestamp,
          });
          // Limit stored messages
          if (messages.length > 1000) {
            messages.splice(0, messages.length - 1000);
          }
        }
      }

      if (method === 'Network.requestWillBeSent') {
        const p = params as {
          requestId: string;
          request: { url: string; method: string; headers: Record<string, string> };
          timestamp: number;
          type: string;
        };
        const requests = this.networkRequests.get(tabId);
        if (requests) {
          requests.push({
            id: p.requestId,
            url: p.request.url,
            method: p.request.method,
            type: p.type,
            timestamp: p.timestamp,
            requestHeaders: p.request.headers,
          });
          if (requests.length > 1000) {
            requests.splice(0, requests.length - 1000);
          }
        }
      }

      if (method === 'Network.responseReceived') {
        const p = params as {
          requestId: string;
          response: { status: number; statusText: string; headers: Record<string, string> };
        };
        const requests = this.networkRequests.get(tabId);
        if (requests) {
          const req = requests.find((r) => r.id === p.requestId);
          if (req) {
            req.status = p.response.status;
            req.statusText = p.response.statusText;
            req.responseHeaders = p.response.headers;
          }
        }
      }
    });
  }
}
