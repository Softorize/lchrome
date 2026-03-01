import type { IToolAdapter } from './IToolAdapter';
import type { ToolDefinition } from '@/types/ai-provider';

export class GoogleToolAdapter implements IToolAdapter {
  toProviderFormat(tools: ToolDefinition[]) {
    return [
      {
        functionDeclarations: tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        })),
      },
    ];
  }

  fromProviderToolCalls(raw: Array<{
    functionCall: { name: string; args: Record<string, unknown> };
  }>) {
    return raw.map((tc) => ({
      id: `call_${crypto.randomUUID().slice(0, 8)}`,
      name: tc.functionCall.name,
      arguments: tc.functionCall.args,
    }));
  }
}
