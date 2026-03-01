import type { MCPRequest, MCPResponse } from '@/types/mcp';
import type { MCPServer } from '@/mcp/server/MCPServer';
import { Logger } from '@/core/logger/Logger';

const DEFAULT_WS_URL = 'ws://127.0.0.1:9333';
const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;

/**
 * Extension-side WebSocket transport.
 *
 * The extension acts as a WebSocket *client* that connects to a local
 * WebSocket relay server.  MCP clients (such as Claude Code) talk to the
 * relay server via stdio, and the relay forwards JSON-RPC messages over the
 * WebSocket connection to this transport.
 *
 * Message flow:
 *   MCP Client -> stdio -> Relay WS Server <-> This Transport -> MCPServer
 */
export class WebSocketTransport {
  private ws: WebSocket | null = null;
  private logger = new Logger('WebSocketTransport');
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _connected = false;
  private url: string;

  constructor(
    private server: MCPServer,
    url?: string,
  ) {
    this.url = url ?? DEFAULT_WS_URL;
  }

  /**
   * Open a WebSocket connection to the relay server.
   */
  connect(): void {
    if (this.ws) {
      this.logger.warn('WebSocket already connected');
      return;
    }

    this.logger.info(`Connecting to WebSocket server at ${this.url}`);

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.logger.info('WebSocket connected');
        this._connected = true;
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event: MessageEvent) => {
        this.onMessage(event.data as string);
      };

      this.ws.onerror = (event: Event) => {
        this.logger.error('WebSocket error', event);
      };

      this.ws.onclose = (event: CloseEvent) => {
        this.logger.warn(`WebSocket closed: code=${event.code} reason=${event.reason}`);
        this._connected = false;
        this.ws = null;
        this.scheduleReconnect();
      };
    } catch (error) {
      this.logger.error('Failed to create WebSocket connection', error);
      this._connected = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Close the WebSocket connection and stop reconnection attempts.
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = MAX_RECONNECT_ATTEMPTS; // prevent reconnect
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this._connected = false;
    this.logger.info('WebSocket transport disconnected');
  }

  get isConnected(): boolean {
    return this._connected;
  }

  // ---- Private ----

  private async onMessage(raw: string): Promise<void> {
    let request: MCPRequest;

    try {
      request = JSON.parse(raw) as MCPRequest;
    } catch {
      this.logger.error('Invalid JSON received on WebSocket', raw);
      this.send(
        JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32700, message: 'Parse error' },
        }),
      );
      return;
    }

    this.logger.debug(`Received MCP request via WebSocket: ${request.method}`, { id: request.id });

    try {
      const response: MCPResponse = await this.server.handleRequest(request);
      this.send(JSON.stringify(response));
    } catch (error) {
      this.logger.error('Error processing MCP request', error);
      const errorResponse: MCPResponse = {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error',
        },
      };
      this.send(JSON.stringify(errorResponse));
    }
  }

  private send(data: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.logger.error('Cannot send: WebSocket is not open');
      return;
    }

    try {
      this.ws.send(data);
    } catch (error) {
      this.logger.error('Failed to send WebSocket message', error);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.logger.error('Max reconnect attempts reached, giving up');
      return;
    }

    const delay = RECONNECT_DELAY_MS * Math.pow(1.5, this.reconnectAttempts);
    this.reconnectAttempts++;
    this.logger.info(
      `Scheduling WebSocket reconnect in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`,
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }
}
