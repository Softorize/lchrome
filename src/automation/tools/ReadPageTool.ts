import type { ITool } from './ITool';
import type { ToolSchema, ToolInput, ToolOutput, ToolContext } from '@/types/automation';
import { ToolError } from '@/core/errors/AppError';

async function injectAndExecute(tabId: number, action: string, payload: unknown) {
  // First ensure content script is injected
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content-scripts/content-script.js'],
    });
  } catch {
    /* may already be injected */
  }

  // Then send message
  return chrome.tabs.sendMessage(tabId, {
    type: 'cs:action',
    action,
    payload,
    requestId: crypto.randomUUID(),
  });
}

export class ReadPageTool implements ITool {
  readonly schema: ToolSchema = {
    name: 'read_page',
    description:
      'Get an accessibility tree representation of elements on the page. By default returns all elements. Optionally filter for only interactive elements. Use ref_id to focus on a specific subtree when the output is too large.',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: {
          type: 'number',
          description: 'The ID of the tab to read.',
        },
        depth: {
          type: 'number',
          description:
            'Maximum depth of the tree to traverse (default: 15). Use a smaller depth if output is too large.',
          default: 15,
        },
        filter: {
          type: 'string',
          description:
            'Filter elements: "interactive" for buttons/links/inputs only, "all" for all elements (default: "all").',
          enum: ['all', 'interactive'],
        },
        ref_id: {
          type: 'string',
          description:
            'Reference ID of a parent element to read. Returns the specified element and all its children. Use to focus on a specific part of the page.',
        },
      },
      required: ['tabId'],
    },
  };

  async execute(input: ToolInput, _context: ToolContext): Promise<ToolOutput> {
    const tabId = input.tabId as number;
    const depth = (input.depth as number) ?? 15;
    const filter = (input.filter as string) ?? 'all';
    const refId = input.ref_id as string | undefined;

    try {
      const result = await injectAndExecute(tabId, 'readPage', {
        depth,
        filter,
        refId,
      });

      if (!result) {
        throw new ToolError('No response from content script', 'read_page');
      }

      const response = result as { success: boolean; data?: string; error?: string };
      if (!response.success) {
        throw new ToolError(
          response.error ?? 'Failed to read page',
          'read_page',
        );
      }

      return {
        content: [
          {
            type: 'text',
            text: response.data ?? '',
          },
        ],
      };
    } catch (error) {
      if (error instanceof ToolError) throw error;
      throw new ToolError(
        `Failed to read page: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'read_page',
      );
    }
  }
}
