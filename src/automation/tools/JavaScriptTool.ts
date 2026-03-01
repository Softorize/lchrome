import type { ITool } from './ITool';
import type { ToolSchema, ToolInput, ToolOutput, ToolContext } from '@/types/automation';
import { ToolError } from '@/core/errors/AppError';

export class JavaScriptTool implements ITool {
  readonly schema: ToolSchema = {
    name: 'javascript',
    description:
      'Execute JavaScript code in the context of the current page. The code runs in the page\'s context and can interact with the DOM, window object, and page variables. Returns the result of the last expression or any thrown errors.',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: {
          type: 'number',
          description: 'The ID of the tab to execute the code in.',
        },
        text: {
          type: 'string',
          description:
            'The JavaScript code to execute. The code will be evaluated in the page context. The result of the last expression will be returned automatically. Do NOT use "return" statements.',
        },
      },
      required: ['tabId', 'text'],
    },
  };

  async execute(input: ToolInput, _context: ToolContext): Promise<ToolOutput> {
    const tabId = input.tabId as number;
    const code = input.text as string;

    if (!code || code.trim().length === 0) {
      throw new ToolError('The "text" parameter must contain JavaScript code', 'javascript');
    }

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: (jsCode: string) => {
          try {
            // Use indirect eval to run in global scope
            const result = (0, eval)(jsCode);
            return { success: true, result: formatResult(result) };
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
            };
          }

          function formatResult(value: unknown): string {
            if (value === undefined) return 'undefined';
            if (value === null) return 'null';
            if (typeof value === 'function') return `[Function: ${value.name || 'anonymous'}]`;
            if (value instanceof HTMLElement) {
              const tag = value.tagName.toLowerCase();
              const id = value.id ? `#${value.id}` : '';
              const cls = value.className
                ? `.${String(value.className).split(' ').join('.')}`
                : '';
              return `<${tag}${id}${cls}>`;
            }
            if (value instanceof NodeList || value instanceof HTMLCollection) {
              return `[${Array.from(value)
                .map((el) => formatResult(el))
                .join(', ')}]`;
            }
            try {
              return JSON.stringify(value, null, 2);
            } catch {
              return String(value);
            }
          }
        },
        args: [code],
        world: 'MAIN',
      });

      if (!results || results.length === 0) {
        throw new ToolError('Script execution returned no results', 'javascript');
      }

      const frameResult = results[0].result as {
        success: boolean;
        result?: string;
        error?: string;
        stack?: string;
      };

      if (!frameResult.success) {
        return {
          content: [
            {
              type: 'text',
              text: `JavaScript error: ${frameResult.error}${frameResult.stack ? `\n${frameResult.stack}` : ''}`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: frameResult.result ?? 'undefined',
          },
        ],
      };
    } catch (error) {
      if (error instanceof ToolError) throw error;
      throw new ToolError(
        `Failed to execute JavaScript: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'javascript',
      );
    }
  }
}
