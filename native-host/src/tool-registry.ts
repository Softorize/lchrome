import { log } from './transport.js';

/**
 * Tool definition as exposed via the MCP protocol.
 */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Result of a tool execution, forwarded from the Chrome extension.
 */
export interface ToolCallResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

/**
 * Callback that actually executes a tool call by forwarding it to the
 * Chrome extension over the native messaging channel.
 */
export type ToolExecutor = (
  name: string,
  args: Record<string, unknown>,
) => Promise<ToolCallResult>;

/**
 * Manages the set of tools available in the MCP server.
 *
 * Tool definitions are synchronized from the Chrome extension at startup
 * and whenever the extension signals that the tool list has changed.
 * Execution requests are forwarded back to the extension via the provided
 * ToolExecutor callback.
 */
export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();
  private executor: ToolExecutor | null = null;

  /**
   * Replace the entire tool list (called when the extension sends its
   * current tool schemas).
   */
  syncTools(definitions: ToolDefinition[]): void {
    this.tools.clear();
    for (const def of definitions) {
      this.tools.set(def.name, def);
    }
    log(`Tool registry synced: ${this.tools.size} tool(s)`);
  }

  /**
   * Set the callback used to forward tool execution to the extension.
   */
  setExecutor(executor: ToolExecutor): void {
    this.executor = executor;
  }

  /**
   * List all registered tool definitions.
   */
  listTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Check whether a given tool exists.
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Execute a tool by name.  The call is forwarded to the Chrome extension
   * through the registered ToolExecutor.
   */
  async execute(name: string, args: Record<string, unknown>): Promise<ToolCallResult> {
    if (!this.executor) {
      return {
        content: [{ type: 'text', text: 'No tool executor registered (extension not connected)' }],
        isError: true,
      };
    }

    if (!this.tools.has(name)) {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    log(`Executing tool: ${name}`);
    return this.executor(name, args);
  }
}
