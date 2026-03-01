import type { ITool } from './ITool';
import type { ToolSchema, ToolInput, ToolOutput, ToolContext } from '@/types/automation';
import type { DebuggerService } from '@/automation/services/DebuggerService';
import { ToolError } from '@/core/errors/AppError';

export class ConsoleMonitorTool implements ITool {
  readonly schema: ToolSchema = {
    name: 'read_console',
    description:
      'Read browser console messages (console.log, console.error, console.warn, etc.) from a specific tab. Useful for debugging JavaScript errors, viewing application logs, or understanding what is happening in the browser console. Provide a pattern to filter messages.',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: {
          type: 'number',
          description: 'The ID of the tab to read console messages from.',
        },
        pattern: {
          type: 'string',
          description:
            'Regex pattern to filter console messages. Only messages matching this pattern will be returned (e.g., "error|warning").',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of messages to return (default: 100).',
          default: 100,
        },
        onlyErrors: {
          type: 'string',
          description:
            'If "true", only return error and exception messages. Default is "false".',
        },
        clear: {
          type: 'string',
          description:
            'If "true", clear the console messages after reading to avoid duplicates on subsequent calls.',
        },
      },
      required: ['tabId'],
    },
  };

  constructor(private readonly debuggerService: DebuggerService) {}

  async execute(input: ToolInput, _context: ToolContext): Promise<ToolOutput> {
    const tabId = input.tabId as number;
    const pattern = input.pattern as string | undefined;
    const limit = (input.limit as number) ?? 100;
    const onlyErrors = input.onlyErrors === 'true' || input.onlyErrors === true;
    const clear = input.clear === 'true' || input.clear === true;

    try {
      // Ensure the debugger is attached
      if (!this.debuggerService.isAttached(tabId)) {
        await this.debuggerService.attach(tabId);
      }

      // Build the effective pattern
      let effectivePattern = pattern;
      if (onlyErrors && !effectivePattern) {
        effectivePattern = '.*'; // match all, we'll filter by type below
      }

      let messages = this.debuggerService.getConsoleMessages(
        tabId,
        effectivePattern,
        limit,
      );

      // Filter for errors only if requested
      if (onlyErrors) {
        messages = messages.filter(
          (m) => m.type === 'error',
        );
      }

      // Clear after reading if requested
      if (clear) {
        this.debuggerService.clearConsole(tabId);
      }

      if (messages.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: pattern
                ? `No console messages matching pattern "${pattern}".`
                : 'No console messages captured.',
            },
          ],
        };
      }

      const formatted = messages
        .map((m) => {
          const time = new Date(m.timestamp).toISOString();
          return `[${time}] [${m.type.toUpperCase()}] ${m.text}`;
        })
        .join('\n');

      return {
        content: [
          {
            type: 'text',
            text: `Console messages (${messages.length}):\n${formatted}`,
          },
        ],
      };
    } catch (error) {
      if (error instanceof ToolError) throw error;
      throw new ToolError(
        `Failed to read console messages: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'read_console',
      );
    }
  }
}
