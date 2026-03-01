#!/usr/bin/env node

/**
 * OmniChrome Native Messaging Host
 *
 * This process is launched by Chrome when the extension calls
 * chrome.runtime.connectNative('com.omnichrome.native').
 *
 * It bridges two protocols:
 *
 *   1. **Stdio transport** (MCP side):
 *      MCP clients such as Claude Code communicate with this process via
 *      stdin/stdout using Chrome's Native Messaging framing (4-byte
 *      little-endian length prefix + JSON payload).
 *
 *   2. **Native Messaging channel** (Chrome extension side):
 *      The same stdin/stdout channel is also used by Chrome to pass
 *      NativeMessage objects to/from the extension.
 *
 * Message routing:
 *   - Incoming messages whose `type` is 'mcp_request' are MCP JSON-RPC
 *     requests originating from the extension.  They are not expected on
 *     stdin in normal operation because MCP clients send raw JSON-RPC.
 *   - Incoming messages that look like raw JSON-RPC (have a `jsonrpc` field)
 *     are MCP requests from an MCP client on stdio.  These are handled by
 *     the MCPNativeServer and the tool calls are forwarded to the extension.
 *   - Messages with type 'extension_response' are responses from the
 *     extension to requests we sent earlier (e.g. tool call results).
 *   - Messages with type 'tools_sync' carry tool definitions from the
 *     extension so the native host knows what tools are available.
 */

import { readMessages, writeMessage, log } from './transport.js';
import { MCPNativeServer } from './mcp-server.js';
import { ToolRegistry } from './tool-registry.js';
import type { ToolCallResult, ToolDefinition } from './tool-registry.js';
import type { MCPRequest } from './mcp-server.js';

// ---- Types for native messaging ----

interface NativeMessage {
  type: 'mcp_request' | 'mcp_response' | 'extension_request' | 'extension_response' | 'tools_sync';
  id: string;
  payload: unknown;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

// ---- State ----

const toolRegistry = new ToolRegistry();
const mcpServer = new MCPNativeServer(toolRegistry);
const pendingRequests = new Map<string, PendingRequest>();
let requestCounter = 0;

/** Timeout for requests sent to the extension (ms). */
const REQUEST_TIMEOUT = 30_000;

// ---- Extension communication helpers ----

/**
 * Send a request to the Chrome extension via the native messaging channel
 * and return a promise that resolves when the extension responds.
 */
function sendToExtension(type: NativeMessage['type'], payload: unknown): Promise<unknown> {
  const id = `native-${++requestCounter}`;

  return new Promise<unknown>((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error(`Extension request timed out (id=${id})`));
    }, REQUEST_TIMEOUT);

    pendingRequests.set(id, { resolve, reject, timer });

    const msg: NativeMessage = { type, id, payload };
    writeMessage(msg);
  });
}

/**
 * Forward a tool execution request to the extension and return the result.
 */
async function executeToolViaExtension(
  name: string,
  args: Record<string, unknown>,
): Promise<ToolCallResult> {
  try {
    const result = await sendToExtension('extension_request', {
      action: 'tool_call',
      name,
      arguments: args,
    });
    return result as ToolCallResult;
  } catch (error) {
    log(`Tool execution failed: ${error}`);
    return {
      content: [
        {
          type: 'text',
          text: `Tool execution error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
}

// ---- Message handling ----

/**
 * Handle an extension_response that matches a pending request.
 */
function handleExtensionResponse(msg: NativeMessage): void {
  const pending = pendingRequests.get(msg.id);
  if (pending) {
    clearTimeout(pending.timer);
    pendingRequests.delete(msg.id);
    pending.resolve(msg.payload);
  } else {
    log(`Received response for unknown request id: ${msg.id}`);
  }
}

/**
 * Handle a tools_sync message from the extension.
 */
function handleToolsSync(msg: NativeMessage): void {
  const definitions = msg.payload as ToolDefinition[];
  toolRegistry.syncTools(definitions);
}

/**
 * Handle an MCP request that arrived from the extension (type=mcp_request).
 * The extension is forwarding a request it received from some other source.
 */
async function handleMcpRequestFromExtension(msg: NativeMessage): Promise<void> {
  const request = msg.payload as MCPRequest;
  const response = await mcpServer.handleRequest(request);
  writeMessage({
    type: 'mcp_response',
    id: msg.id,
    payload: response,
  } satisfies NativeMessage);
}

/**
 * Handle a raw MCP JSON-RPC request that arrived directly on stdio from an
 * MCP client (e.g. Claude Code).
 */
async function handleStdioMcpRequest(request: MCPRequest): Promise<void> {
  const response = await mcpServer.handleRequest(request);
  writeMessage(response);
}

/**
 * Determine what kind of message arrived and route accordingly.
 */
async function routeMessage(message: unknown): Promise<void> {
  if (!message || typeof message !== 'object') {
    log('Received non-object message, ignoring');
    return;
  }

  const msg = message as Record<string, unknown>;

  // Check if this is a NativeMessage envelope (has a `type` field with known value)
  if (typeof msg.type === 'string' && typeof msg.id === 'string') {
    const nativeMsg = msg as unknown as NativeMessage;

    switch (nativeMsg.type) {
      case 'extension_response':
        handleExtensionResponse(nativeMsg);
        return;

      case 'tools_sync':
        handleToolsSync(nativeMsg);
        return;

      case 'mcp_request':
        await handleMcpRequestFromExtension(nativeMsg);
        return;

      case 'mcp_response':
        // We don't normally receive mcp_response on stdin, but handle it
        // gracefully in case the extension echoes back.
        handleExtensionResponse(nativeMsg);
        return;

      case 'extension_request':
        // The extension asking the native host to do something -- currently
        // we have no handlers for this direction, so log and ignore.
        log(`Received extension_request (not handled): ${JSON.stringify(nativeMsg.payload)}`);
        return;
    }
  }

  // Check if this is a raw JSON-RPC 2.0 message (MCP request from stdio client)
  if (msg.jsonrpc === '2.0' && typeof msg.method === 'string') {
    await handleStdioMcpRequest(msg as unknown as MCPRequest);
    return;
  }

  log(`Unknown message format: ${JSON.stringify(msg).slice(0, 200)}`);
}

// ---- Startup ----

function main(): void {
  log('OmniChrome native host starting...');

  // Wire up the tool executor so tool calls are forwarded to the extension
  toolRegistry.setExecutor(executeToolViaExtension);

  // Start reading messages from stdin
  readMessages((message) => {
    routeMessage(message).catch((error) => {
      log(`Unhandled error in message routing: ${error}`);
    });
  });

  // Request tool list from the extension on startup
  sendToExtension('extension_request', { action: 'list_tools' }).then(
    (result) => {
      if (Array.isArray(result)) {
        toolRegistry.syncTools(result as ToolDefinition[]);
      }
    },
    (error) => {
      log(`Failed to fetch initial tool list: ${error}`);
    },
  );

  log('OmniChrome native host ready');
}

main();
