import type { MessageBus } from '@/infrastructure/messaging/MessageBus';
import type { ToolInput, ToolContext, ToolOutput } from '@/types/automation';
import { Logger } from '@/core/logger/Logger';

const logger = new Logger('ToolHandler');

// Tool registry will be populated by individual tool registrations
const tools = new Map<string, {
  execute: (input: ToolInput, context: ToolContext) => Promise<ToolOutput>;
  schema: unknown;
}>();

export function registerTool(
  name: string,
  tool: {
    execute: (input: ToolInput, context: ToolContext) => Promise<ToolOutput>;
    schema: unknown;
  },
): void {
  tools.set(name, tool);
  logger.debug(`Registered tool: ${name}`);
}

export function setupToolHandler(bus: MessageBus): void {
  bus.on('tool:list', () => {
    return Array.from(tools.keys());
  });

  bus.on('tool:schemas', () => {
    const schemas: Record<string, unknown> = {};
    for (const [name, tool] of tools) {
      schemas[name] = tool.schema;
    }
    return schemas;
  });

  bus.on('tool:execute', async (payload: { name: string; input: ToolInput; context: ToolContext }) => {
    const tool = tools.get(payload.name);
    if (!tool) {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${payload.name}` }],
        isError: true,
      } as ToolOutput;
    }

    try {
      return await tool.execute(payload.input, payload.context);
    } catch (error) {
      logger.error(`Tool ${payload.name} execution failed`, error);
      return {
        content: [{ type: 'text', text: `Tool error: ${error instanceof Error ? error.message : 'Unknown error'}` }],
        isError: true,
      } as ToolOutput;
    }
  });

  logger.info('Tool handler initialized');
}
