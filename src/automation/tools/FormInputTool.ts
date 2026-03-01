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

export class FormInputTool implements ITool {
  readonly schema: ToolSchema = {
    name: 'form_input',
    description:
      'Set values in form elements using an element reference ID obtained from read_page or find tools. Supports text inputs, checkboxes, radio buttons, selects, and other form controls.',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: {
          type: 'number',
          description: 'The ID of the tab containing the form element.',
        },
        ref: {
          type: 'string',
          description:
            'Element reference ID from the read_page or find tools (e.g., "ref_1", "ref_2").',
        },
        value: {
          type: 'string',
          description:
            'The value to set. For checkboxes use "true"/"false", for selects use the option value or text, for other inputs use the appropriate string value.',
        },
      },
      required: ['tabId', 'ref', 'value'],
    },
  };

  async execute(input: ToolInput, _context: ToolContext): Promise<ToolOutput> {
    const tabId = input.tabId as number;
    const ref = input.ref as string;
    const value = input.value;

    try {
      const result = await injectAndExecute(tabId, 'formInput', {
        ref,
        value,
      });

      if (!result) {
        throw new ToolError('No response from content script', 'form_input');
      }

      const response = result as { success: boolean; error?: string; elementInfo?: string };
      if (!response.success) {
        throw new ToolError(
          response.error ?? 'Failed to set form value',
          'form_input',
        );
      }

      return {
        content: [
          {
            type: 'text',
            text: response.elementInfo
              ? `Set value on ${response.elementInfo} successfully.`
              : `Set value on element ${ref} successfully.`,
          },
        ],
      };
    } catch (error) {
      if (error instanceof ToolError) throw error;
      throw new ToolError(
        `Failed to set form input: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'form_input',
      );
    }
  }
}
