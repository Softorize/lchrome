import type { NativeMessage } from '@/types/mcp';
import { Logger } from '@/core/logger/Logger';

const NATIVE_HOST_NAME = 'com.omnichrome.native';

export class NativeMessagingBridge {
  private port: chrome.runtime.Port | null = null;
  private logger = new Logger('NativeMessaging');
  private messageHandlers = new Map<string, (payload: unknown) => void>();
  private pendingRequests = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();

  connect(): void {
    if (this.port) return;

    try {
      this.port = chrome.runtime.connectNative(NATIVE_HOST_NAME);

      this.port.onMessage.addListener((msg: NativeMessage) => {
        this.handleMessage(msg);
      });

      this.port.onDisconnect.addListener(() => {
        const error = chrome.runtime.lastError?.message;
        this.logger.warn('Native host disconnected', error);
        this.port = null;
        this.rejectPending(new Error(`Native host disconnected: ${error}`));
      });

      this.logger.info('Connected to native host');
    } catch (error) {
      this.logger.error('Failed to connect to native host', error);
      throw error;
    }
  }

  disconnect(): void {
    if (this.port) {
      this.port.disconnect();
      this.port = null;
    }
  }

  async sendRequest(payload: unknown): Promise<unknown> {
    if (!this.port) {
      this.connect();
    }

    const id = crypto.randomUUID();
    const message: NativeMessage = {
      type: 'extension_request',
      id,
      payload,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Native message timeout'));
      }, 30000);

      this.pendingRequests.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });

      this.port!.postMessage(message);
    });
  }

  onMessage(type: string, handler: (payload: unknown) => void): void {
    this.messageHandlers.set(type, handler);
  }

  sendResponse(id: string, payload: unknown): void {
    if (!this.port) return;

    const message: NativeMessage = {
      type: 'extension_response',
      id,
      payload,
    };

    this.port.postMessage(message);
  }

  get isConnected(): boolean {
    return this.port !== null;
  }

  private handleMessage(msg: NativeMessage): void {
    if (msg.type === 'extension_response' || msg.type === 'mcp_response') {
      const pending = this.pendingRequests.get(msg.id);
      if (pending) {
        this.pendingRequests.delete(msg.id);
        pending.resolve(msg.payload);
      }
    } else {
      const handler = this.messageHandlers.get(msg.type);
      if (handler) {
        handler(msg.payload);
      } else {
        this.logger.warn(`No handler for native message type: ${msg.type}`);
      }
    }
  }

  private rejectPending(error: Error): void {
    for (const [id, { reject }] of this.pendingRequests) {
      reject(error);
      this.pendingRequests.delete(id);
    }
  }
}
