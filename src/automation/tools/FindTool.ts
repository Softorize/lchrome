import type { ITool } from './ITool';
import type { ToolSchema, ToolInput, ToolOutput, ToolContext } from '@/types/automation';
import { ToolError } from '@/core/errors/AppError';

async function injectAndExecute(tabId: number, action: string, payload: unknown) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content-scripts/content-script.js'],
    });
  } catch {
    /* may already be injected */
  }

  return chrome.tabs.sendMessage(tabId, {
    type: 'cs:action',
    action,
    payload,
    requestId: crypto.randomUUID(),
  });
}

export class FindTool implements ITool {
  readonly schema: ToolSchema = {
    name: 'find',
    description:
      'Find elements on the page using natural language. Can search by purpose (e.g., "search bar", "login button") or by text content (e.g., "product title containing organic"). Returns up to 20 matching elements with reference IDs that can be used with other tools.',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: {
          type: 'number',
          description: 'The ID of the tab to search in.',
        },
        query: {
          type: 'string',
          description:
            'Natural language description of what to find (e.g., "search bar", "add to cart button", "product title containing organic").',
        },
      },
      required: ['tabId', 'query'],
    },
  };

  async execute(input: ToolInput, _context: ToolContext): Promise<ToolOutput> {
    const tabId = input.tabId as number;
    const query = input.query as string;

    if (!query || query.trim().length === 0) {
      throw new ToolError('The "query" parameter must be a non-empty string', 'find');
    }

    try {
      const result = await injectAndExecute(tabId, 'findElement', { query });

      if (!result) {
        throw new ToolError('No response from content script', 'find');
      }

      const response = result as {
        success: boolean;
        data?: string;
        matches?: Array<{
          ref: string;
          tagName: string;
          role?: string;
          text?: string;
          ariaLabel?: string;
          bounds?: { x: number; y: number; width: number; height: number };
        }>;
        error?: string;
      };

      if (!response.success) {
        throw new ToolError(
          response.error ?? 'Failed to find elements',
          'find',
        );
      }

      // Format the results as readable text
      if (response.matches && response.matches.length > 0) {
        const formatted = response.matches
          .map((m) => {
            const parts = [`[${m.ref}] <${m.tagName}>`];
            if (m.role) parts.push(`role="${m.role}"`);
            if (m.ariaLabel) parts.push(`aria-label="${m.ariaLabel}"`);
            if (m.text) parts.push(`text="${m.text}"`);
            if (m.bounds) {
              parts.push(
                `bounds=(${m.bounds.x}, ${m.bounds.y}, ${m.bounds.width}x${m.bounds.height})`,
              );
            }
            return parts.join(' ');
          })
          .join('\n');

        return {
          content: [
            {
              type: 'text',
              text: `Found ${response.matches.length} matching element(s):\n${formatted}`,
            },
          ],
        };
      }

      // If data is returned as a string instead of structured matches
      if (response.data) {
        return {
          content: [{ type: 'text', text: response.data }],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: `No elements found matching: "${query}"`,
          },
        ],
      };
    } catch (error) {
      if (error instanceof ToolError) throw error;
      throw new ToolError(
        `Failed to find elements: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'find',
      );
    }
  }
}
