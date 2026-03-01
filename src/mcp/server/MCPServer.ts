import type {
  MCPRequest,
  MCPResponse,
  MCPToolDefinition,
  MCPServerInfo,
  MCPToolCallResult,
} from '@/types/mcp';
import type { ToolRegistry } from '@/automation/tools/ToolRegistry';
import type { ToolContext } from '@/types/automation';
import { Logger } from '@/core/logger/Logger';

const PROTOCOL_VERSION = '2024-11-05';
const SERVER_NAME = 'omnichrome';
const SERVER_VERSION = '0.1.0';

export class MCPServer {
  private logger = new Logger('MCPServer');
  private initialized = false;

  constructor(private toolRegistry: ToolRegistry) {}

  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    const { method, params, id } = request;

    this.logger.debug(`Handling MCP request: ${method}`, { id, params });

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
          return this.handlePing(id);

        default:
          this.logger.warn(`Unknown MCP method: ${method}`);
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
      this.logger.error(`Error handling MCP request: ${method}`, error);
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error',
          data: error instanceof Error ? error.stack : undefined,
        },
      };
    }
  }

  getServerInfo(): MCPServerInfo {
    return {
      name: SERVER_NAME,
      version: SERVER_VERSION,
      capabilities: {
        tools: { listChanged: true },
      },
    };
  }

  getToolDefinitions(): MCPToolDefinition[] {
    return this.toolRegistry.getSchemas().map((schema) => ({
      name: schema.name,
      description: schema.description,
      inputSchema: {
        type: 'object' as const,
        properties: schema.inputSchema.properties as Record<string, unknown>,
        required: schema.inputSchema.required,
      },
    }));
  }

  private handleInitialize(id: string | number): MCPResponse {
    this.initialized = true;
    const info = this.getServerInfo();

    this.logger.info('MCP server initialized', { protocolVersion: PROTOCOL_VERSION });

    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: PROTOCOL_VERSION,
        serverInfo: {
          name: info.name,
          version: info.version,
        },
        capabilities: info.capabilities,
      },
    };
  }

  private handleInitialized(id: string | number): MCPResponse {
    // Acknowledgement notification -- no meaningful result needed
    this.logger.debug('MCP client acknowledged initialization');
    return {
      jsonrpc: '2.0',
      id,
      result: {},
    };
  }

  private handleToolsList(id: string | number): MCPResponse {
    const tools = this.getToolDefinitions();
    this.logger.debug(`Returning ${tools.length} tool definitions`);

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

    this.logger.info(`Executing tool: ${toolName}`, toolArgs);

    // MCP calls don't have a specific tab context; the tool must determine it
    const context: ToolContext = {
      tabId: (toolArgs.tabId as number) ?? -1,
    };

    const output = await this.toolRegistry.execute(toolName, toolArgs, context);

    const result: MCPToolCallResult = {
      content: output.content.map((c) => ({
        type: c.type === 'image' ? 'image' : 'text',
        text: c.text,
        data: c.data,
        mimeType: c.mimeType,
      })),
      isError: output.isError,
    };

    return {
      jsonrpc: '2.0',
      id,
      result,
    };
  }

  private handlePing(id: string | number): MCPResponse {
    return {
      jsonrpc: '2.0',
      id,
      result: {},
    };
  }
}
