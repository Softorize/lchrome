import type { IToolAdapter } from './IToolAdapter';
import type { ToolDefinition } from '@/types/ai-provider';

export class OpenAIToolAdapter implements IToolAdapter {
  toProviderFormat(tools: ToolDefinition[]) {
    return tools.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    }));
  }

  fromProviderToolCalls(raw: Array<{
    id: string;
    type: string;
    function: { name: string; arguments: string };
  }>) {
    return raw.map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments),
    }));
  }
}
