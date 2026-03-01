import type { ToolDefinition } from '@/types/ai-provider';

export interface IToolAdapter {
  toProviderFormat(tools: ToolDefinition[]): unknown[];
  fromProviderToolCalls(raw: unknown[]): Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
}
