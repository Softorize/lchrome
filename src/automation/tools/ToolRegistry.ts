import type { ITool } from './ITool';
import type { ToolInput, ToolOutput, ToolContext, ToolSchema } from '@/types/automation';
import type { ToolDefinition } from '@/types/ai-provider';
import { Logger } from '@/core/logger/Logger';
import { ToolError } from '@/core/errors/AppError';

export class ToolRegistry {
  private tools = new Map<string, ITool>();
  private logger = new Logger('ToolRegistry');

  register(tool: ITool): void {
    this.tools.set(tool.schema.name, tool);
    this.logger.debug(`Registered tool: ${tool.schema.name}`);
  }

  async execute(name: string, input: ToolInput, context: ToolContext): Promise<ToolOutput> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new ToolError(`Unknown tool: ${name}`, name);
    }

    this.logger.debug(`Executing tool: ${name}`, input);

    try {
      const result = await tool.execute(input, context);
      this.logger.debug(`Tool ${name} completed`, { isError: result.isError });
      return result;
    } catch (error) {
      this.logger.error(`Tool ${name} failed`, error);
      return {
        content: [
          {
            type: 'text',
            text: `Tool error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
        isError: true,
      };
    }
  }

  getSchemas(): ToolSchema[] {
    return Array.from(this.tools.values()).map((t) => t.schema);
  }

  toToolDefinitions(): ToolDefinition[] {
    return this.getSchemas().map((s) => ({
      name: s.name,
      description: s.description,
      inputSchema: s.inputSchema as Record<string, unknown>,
    }));
  }

  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }
}

export const toolRegistry = new ToolRegistry();
