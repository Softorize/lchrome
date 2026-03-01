import type { MCPRequest, NativeMessage } from '@/types/mcp';
import type { MCPServer } from '@/mcp/server/MCPServer';
import { Logger } from '@/core/logger/Logger';

const NATIVE_HOST_NAME = 'com.omnichrome.native';

/**
 * Extension-side transport that bridges between the Chrome Native Messaging
 * channel and the in-extension MCPServer.
 *
 * Lifecycle:
 *   1. The native host process is launched by Chrome when connect() is called.
 *   2. The native host sends MCP requests (JSON-RPC 2.0) wrapped in NativeMessage.
 *   3. This transport unwraps them, hands them to MCPServer, and sends the
 *      response back through the native port.
 */
export class NativeMessagingTransport {
  private port: chrome.runtime.Port | null = null;
  private logger = new Logger('NativeMessagingTransport');
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _connected = false;

  constructor(private server: MCPServer) {}

  /**
   * Open a connection to the native messaging host and start listening.
   */
  connect(): void {
    if (this.port) {
      this.logger.warn('Already connected to native host');
      return;
    }

    try {
      this.port = chrome.runtime.connectNative(NATIVE_HOST_NAME);
      this._connected = true;

      this.port.onMessage.addListener((msg: NativeMessage) => {
        this.onNativeMessage(msg);
      });

      this.port.onDisconnect.addListener(() => {
        const error = chrome.runtime.lastError?.message ?? 'unknown reason';
        this.logger.warn(`Native host disconnected: ${error}`);
        this.port = null;
        this._connected = false;
      });

      this.logger.info('Connected to native messaging host');
    } catch (error) {
      this.logger.error('Failed to connect to native host', error);
      this._connected = false;
      throw error;
    }
  }

  /**
   * Disconnect from the native messaging host.
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.port) {
      this.port.disconnect();
      this.port = null;
    }
    this._connected = false;
    this.logger.info('Disconnected from native messaging host');
  }

  get isConnected(): boolean {
    return this._connected;
  }

  // ---- Private ----

  private async onNativeMessage(msg: NativeMessage): Promise<void> {
    if (msg.type !== 'mcp_request') {
      this.logger.debug(`Ignoring non-MCP native message type: ${msg.type}`);
      return;
    }

    const request = msg.payload as MCPRequest;
    this.logger.debug(`Received MCP request via native: ${request.method}`, { id: request.id });

    try {
      const response = await this.server.handleRequest(request);
      this.sendNativeMessage({
        type: 'mcp_response',
        id: msg.id,
        payload: response,
      });
    } catch (error) {
      this.logger.error('Failed to handle MCP request from native host', error);
      this.sendNativeMessage({
        type: 'mcp_response',
        id: msg.id,
        payload: {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : 'Internal error',
          },
        },
      });
    }
  }

  private sendNativeMessage(msg: NativeMessage): void {
    if (!this.port) {
      this.logger.error('Cannot send message: not connected to native host');
      return;
    }

    try {
      this.port.postMessage(msg);
    } catch (error) {
      this.logger.error('Failed to send native message', error);
    }
  }
}
