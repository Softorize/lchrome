import type { ToolRegistry, ToolCallResult } from './tool-registry.js';
import { log } from './transport.js';

// ---- MCP JSON-RPC types ----

export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

// ---- Constants ----

const PROTOCOL_VERSION = '2024-11-05';
const SERVER_NAME = 'omnichrome';
const SERVER_VERSION = '0.1.0';

/**
 * Native-side MCP protocol implementation.
 *
 * This server speaks JSON-RPC 2.0 (the MCP wire format) and delegates
 * actual tool execution to the Chrome extension through the ToolRegistry.
 *
 * Supported methods:
 *   - initialize       Return server info + capabilities
 *   - initialized      Acknowledgement from client (no-op)
 *   - notifications/initialized  Same as initialized
 *   - tools/list       Return tool schemas from ToolRegistry
 *   - tools/call       Forward tool execution to extension
 *   - ping             Respond with empty result
 */
export class MCPNativeServer {
  private initialized = false;

  constructor(private toolRegistry: ToolRegistry) {}

  /**
   * Handle an incoming MCP JSON-RPC request and return the response.
   */
  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    const { method, params, id } = request;

    log(`MCP request: ${method} (id=${id})`);

    try {
      switch (method) {
        case 'initialize':
          return this.handleInitialize(id);

        case 'initialized':
        case 'notifications/initialized':
          return this.handleInitialized(id);

        case 'tools/list':
          return this.handleToolsList(id);

        case 'tools/call':
          return await this.handleToolsCall(id, params);

        case 'ping':
          return { jsonrpc: '2.0', id, result: {} };

        default:
          log(`Unknown method: ${method}`);
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32601,
              message: `Method not found: ${method}`,
            },
          };
      }
    } catch (error) {
      log(`Error handling ${method}: ${error}`);
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error',
        },
      };
    }
  }

  // ---- Method handlers ----

  private handleInitialize(id: string | number): MCPResponse {
    this.initialized = true;
    log('MCP server initialized');

    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: PROTOCOL_VERSION,
        serverInfo: {
          name: SERVER_NAME,
          version: SERVER_VERSION,
        },
        capabilities: {
          tools: { listChanged: true },
        },
      },
    };
  }

  private handleInitialized(id: string | number): MCPResponse {
    log('Client acknowledged initialization');
    return { jsonrpc: '2.0', id, result: {} };
  }

  private handleToolsList(id: string | number): MCPResponse {
    const tools = this.toolRegistry.listTools();
    log(`Returning ${tools.length} tool(s)`);

    return {
      jsonrpc: '2.0',
      id,
      result: { tools },
    };
  }

  private async handleToolsCall(
    id: string | number,
    params?: Record<string, unknown>,
  ): Promise<MCPResponse> {
    const toolName = params?.name as string | undefined;
    const toolArgs = (params?.arguments as Record<string, unknown>) ?? {};

    if (!toolName) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32602,
          message: 'Missing required parameter: name',
        },
      };
    }

    if (!this.toolRegistry.has(toolName)) {
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32602,
          message: `Unknown tool: ${toolName}`,
        },
      };
    }

    log(`Calling tool: ${toolName}`);
    const result: ToolCallResult = await this.toolRegistry.execute(toolName, toolArgs);

    return {
      jsonrpc: '2.0',
      id,
      result,
    };
  }
}
