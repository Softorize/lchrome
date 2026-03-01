import type { IToolAdapter } from './IToolAdapter';
import type { ToolDefinition } from '@/types/ai-provider';

export class AnthropicToolAdapter implements IToolAdapter {
  toProviderFormat(tools: ToolDefinition[]) {
    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
    }));
  }

  fromProviderToolCalls(raw: Array<{
    type: string;
    id: string;
    name: string;
    input: Record<string, unknown>;
  }>) {
    return raw
      .filter((c) => c.type === 'tool_use')
      .map((tc) => ({
        id: tc.id,
        name: tc.name,
        arguments: tc.input,
      }));
  }
}
