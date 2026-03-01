import type { MessageBus } from '@/infrastructure/messaging/MessageBus';
import type { MCPRequest, MCPResponse } from '@/types/mcp';
import { NativeMessagingBridge } from '@/infrastructure/messaging/NativeMessaging';
import { Logger } from '@/core/logger/Logger';

const logger = new Logger('MCPHandler');
let bridge: NativeMessagingBridge | null = null;

export function setupMcpHandler(bus: MessageBus): void {
  bus.on('mcp:request', async (payload: MCPRequest) => {
    return handleMcpRequest(payload);
  });

  // Listen for native messaging connections
  try {
    bridge = new NativeMessagingBridge();
    bridge.onMessage('mcp_request', async (payload) => {
      const request = payload as MCPRequest;
      const response = await handleMcpRequest(request);
      bridge!.sendResponse(request.id as string, response);
    });
    logger.info('MCP handler initialized with native messaging');
  } catch (error) {
    logger.warn('Native messaging not available, MCP via native disabled', error);
  }
}

async function handleMcpRequest(request: MCPRequest): Promise<MCPResponse> {
  const { method, params, id } = request;

  try {
    switch (method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            serverInfo: {
              name: 'omnichrome',
              version: '0.1.0',
            },
            capabilities: {
              tools: { listChanged: true },
            },
          },
        };

      case 'tools/list':
        // Will be populated by tool registry
        return {
          jsonrpc: '2.0',
          id,
          result: { tools: [] },
        };

      case 'tools/call': {
        const toolName = (params as { name: string })?.name;
        const toolArgs = (params as { arguments: Record<string, unknown> })?.arguments ?? {};
        // Delegate to tool handler
        const result = await chrome.runtime.sendMessage({
          type: 'tool:execute',
          id: crypto.randomUUID(),
          payload: {
            name: toolName,
            input: toolArgs,
            context: { tabId: -1 }, // MCP calls need tab context
          },
        });
        return { jsonrpc: '2.0', id, result: result.data };
      }

      case 'ping':
        return { jsonrpc: '2.0', id, result: {} };

      default:
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${method}` },
        };
    }
  } catch (error) {
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
