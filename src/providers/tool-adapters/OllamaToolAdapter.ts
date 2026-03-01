import type { IToolAdapter } from './IToolAdapter';
import type { ToolDefinition } from '@/types/ai-provider';

export class OllamaToolAdapter implements IToolAdapter {
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
    function: { name: string; arguments: Record<string, unknown> };
  }>) {
    return raw.map((tc) => ({
      id: `call_${crypto.randomUUID().slice(0, 8)}`,
      name: tc.function.name,
      arguments: tc.function.arguments,
    }));
  }
}
