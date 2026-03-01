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

export class GetPageTextTool implements ITool {
  readonly schema: ToolSchema = {
    name: 'get_page_text',
    description:
      'Extract raw text content from the page, prioritizing article content. Ideal for reading articles, blog posts, or other text-heavy pages. Returns plain text without HTML formatting.',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: {
          type: 'number',
          description: 'The ID of the tab to extract text from.',
        },
      },
      required: ['tabId'],
    },
  };

  async execute(input: ToolInput, _context: ToolContext): Promise<ToolOutput> {
    const tabId = input.tabId as number;

    try {
      const result = await injectAndExecute(tabId, 'getText', {});

      if (!result) {
        throw new ToolError('No response from content script', 'get_page_text');
      }

      const response = result as { success: boolean; data?: string; error?: string };
      if (!response.success) {
        throw new ToolError(
          response.error ?? 'Failed to extract page text',
          'get_page_text',
        );
      }

      const text = response.data ?? '';

      if (text.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'The page appears to have no extractable text content.',
            },
          ],
        };
      }

      return {
        content: [{ type: 'text', text }],
      };
    } catch (error) {
      if (error instanceof ToolError) throw error;
      throw new ToolError(
        `Failed to extract page text: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'get_page_text',
      );
    }
  }
}
