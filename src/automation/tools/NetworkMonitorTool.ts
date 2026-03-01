import type { ITool } from './ITool';
import type { ToolSchema, ToolInput, ToolOutput, ToolContext } from '@/types/automation';
import type { DebuggerService } from '@/automation/services/DebuggerService';
import { ToolError } from '@/core/errors/AppError';

export class NetworkMonitorTool implements ITool {
  readonly schema: ToolSchema = {
    name: 'read_network',
    description:
      'Read HTTP network requests (XHR, Fetch, documents, images, etc.) from a specific tab. Useful for debugging API calls, monitoring network activity, or understanding what requests a page is making.',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: {
          type: 'number',
          description: 'The ID of the tab to read network requests from.',
        },
        urlPattern: {
          type: 'string',
          description:
            'Optional URL pattern to filter requests. Only requests whose URL contains this string will be returned (e.g., "/api/").',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of requests to return (default: 100).',
          default: 100,
        },
        clear: {
          type: 'string',
          description:
            'If "true", clear the network requests after reading to avoid duplicates on subsequent calls.',
        },
      },
      required: ['tabId'],
    },
  };

  constructor(private readonly debuggerService: DebuggerService) {}

  async execute(input: ToolInput, _context: ToolContext): Promise<ToolOutput> {
    const tabId = input.tabId as number;
    const urlPattern = input.urlPattern as string | undefined;
    const limit = (input.limit as number) ?? 100;
    const clear = input.clear === 'true' || input.clear === true;

    try {
      // Ensure the debugger is attached
      if (!this.debuggerService.isAttached(tabId)) {
        await this.debuggerService.attach(tabId);
      }

      const requests = this.debuggerService.getNetworkRequests(
        tabId,
        urlPattern,
        limit,
      );

      // Clear after reading if requested
      if (clear) {
        this.debuggerService.clearNetwork(tabId);
      }

      if (requests.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: urlPattern
                ? `No network requests matching pattern "${urlPattern}".`
                : 'No network requests captured.',
            },
          ],
        };
      }

      const formatted = requests
        .map((r) => {
          const status = r.status ? `${r.status} ${r.statusText ?? ''}`.trim() : 'pending';
          const duration = r.duration ? `${r.duration}ms` : '';
          const size = r.size ? `${formatBytes(r.size)}` : '';
          const meta = [status, r.type, duration, size].filter(Boolean).join(' | ');
          return `${r.method} ${r.url}\n  [${meta}]`;
        })
        .join('\n\n');

      return {
        content: [
          {
            type: 'text',
            text: `Network requests (${requests.length}):\n\n${formatted}`,
          },
        ],
      };
    } catch (error) {
      if (error instanceof ToolError) throw error;
      throw new ToolError(
        `Failed to read network requests: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'read_network',
      );
    }
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
