import type { ToolSchema, ToolInput, ToolOutput, ToolContext } from '@/types/automation';

export interface ITool {
  readonly schema: ToolSchema;
  execute(input: ToolInput, context: ToolContext): Promise<ToolOutput>;
}
