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

export class ComputerTool implements ITool {
  readonly schema: ToolSchema = {
    name: 'computer',
    description:
      'Use mouse and keyboard to interact with a web browser and take screenshots. Supports clicking, typing, scrolling, hovering, dragging, key presses, screenshots, and zooming into regions.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description:
            'The action to perform: left_click, right_click, double_click, triple_click, type, screenshot, scroll, key, hover, left_click_drag, zoom.',
          enum: [
            'left_click',
            'right_click',
            'double_click',
            'triple_click',
            'type',
            'screenshot',
            'scroll',
            'key',
            'hover',
            'left_click_drag',
            'zoom',
          ],
        },
        tabId: {
          type: 'number',
          description: 'The ID of the tab to perform the action on.',
        },
        coordinate: {
          type: 'array',
          description:
            '(x, y) coordinates in pixels. Required for click, scroll, hover, and drag end position.',
          items: { type: 'number' },
        },
        text: {
          type: 'string',
          description:
            'The text to type (for "type" action) or the key(s) to press (for "key" action). For "key", provide space-separated keys.',
        },
        scroll_direction: {
          type: 'string',
          description: 'The direction to scroll: up, down, left, right.',
          enum: ['up', 'down', 'left', 'right'],
        },
        scroll_amount: {
          type: 'number',
          description: 'Number of scroll ticks (default: 3, max: 10).',
          default: 3,
          minimum: 1,
          maximum: 10,
        },
        ref: {
          type: 'string',
          description:
            'Element reference ID from read_page or find tools. Can be used as an alternative to coordinate for click actions.',
        },
        region: {
          type: 'array',
          description:
            '(x0, y0, x1, y1) rectangular region for the "zoom" action. Captures a close-up of that area.',
          items: { type: 'number' },
        },
        start_coordinate: {
          type: 'array',
          description: '(x, y) starting coordinates for left_click_drag.',
          items: { type: 'number' },
        },
        modifiers: {
          type: 'string',
          description:
            'Modifier keys for click actions. Supports: "ctrl", "shift", "alt", "cmd"/"meta". Combine with "+" (e.g., "ctrl+shift").',
        },
        repeat: {
          type: 'number',
          description:
            'Number of times to repeat a key sequence (only for "key" action, default: 1, max: 100).',
          default: 1,
          minimum: 1,
          maximum: 100,
        },
        duration: {
          type: 'number',
          description:
            'Number of seconds to wait (only for "wait" action, max: 30).',
          maximum: 30,
          minimum: 0,
        },
      },
      required: ['action', 'tabId'],
    },
  };

  async execute(input: ToolInput, _context: ToolContext): Promise<ToolOutput> {
    const action = input.action as string;
    const tabId = input.tabId as number;

    try {
      switch (action) {
        case 'screenshot':
          return this.handleScreenshot(tabId);
        case 'zoom':
          return this.handleZoom(tabId, input.region as number[]);
        case 'left_click':
        case 'right_click':
        case 'double_click':
        case 'triple_click':
          return this.handleClick(tabId, action, input);
        case 'type':
          return this.handleType(tabId, input.text as string);
        case 'key':
          return this.handleKey(tabId, input.text as string, (input.repeat as number) ?? 1);
        case 'scroll':
          return this.handleScroll(tabId, input);
        case 'hover':
          return this.handleHover(tabId, input);
        case 'left_click_drag':
          return this.handleDrag(tabId, input);
        default:
          throw new ToolError(`Unknown action: ${action}`, 'computer');
      }
    } catch (error) {
      if (error instanceof ToolError) throw error;
      throw new ToolError(
        `Computer action "${action}" failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'computer',
      );
    }
  }

  private async handleScreenshot(tabId: number): Promise<ToolOutput> {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.windowId) {
      throw new ToolError('Tab has no associated window', 'computer');
    }

    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'png',
      quality: 100,
    });

    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    return {
      content: [{ type: 'image', data: base64Data, mimeType: 'image/png' }],
    };
  }

  private async handleZoom(tabId: number, region: number[] | undefined): Promise<ToolOutput> {
    if (!region || region.length !== 4) {
      throw new ToolError(
        'The "zoom" action requires a "region" parameter with [x0, y0, x1, y1]',
        'computer',
      );
    }

    const [x0, y0, x1, y1] = region;
    const width = x1 - x0;
    const height = y1 - y0;

    if (width <= 0 || height <= 0) {
      throw new ToolError('Invalid region: width and height must be positive', 'computer');
    }

    const tab = await chrome.tabs.get(tabId);
    if (!tab.windowId) {
      throw new ToolError('Tab has no associated window', 'computer');
    }

    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'png',
      quality: 100,
    });

    // Crop the image using OffscreenCanvas
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const imageBitmap = await createImageBitmap(blob, x0, y0, width, height);

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new ToolError('Failed to create canvas context', 'computer');
    }
    ctx.drawImage(imageBitmap, 0, 0);
    imageBitmap.close();

    const resultBlob = await canvas.convertToBlob({ type: 'image/png' });
    const base64Data = await this.blobToBase64(resultBlob);

    return {
      content: [{ type: 'image', data: base64Data, mimeType: 'image/png' }],
    };
  }

  private async handleClick(tabId: number, action: string, input: ToolInput): Promise<ToolOutput> {
    const coordinate = input.coordinate as number[] | undefined;
    const ref = input.ref as string | undefined;
    const modifiers = input.modifiers as string | undefined;

    if (!coordinate && !ref) {
      throw new ToolError(
        `The "${action}" action requires either "coordinate" or "ref"`,
        'computer',
      );
    }

    const result = await injectAndExecute(tabId, 'mouseAction', {
      action,
      coordinate,
      ref,
      modifiers: modifiers ? modifiers.split('+').map((m) => m.trim()) : undefined,
    });

    const response = result as { success: boolean; error?: string };
    if (!response.success) {
      throw new ToolError(response.error ?? `Click action failed`, 'computer');
    }

    return {
      content: [{ type: 'text', text: `Performed ${action} successfully.` }],
    };
  }

  private async handleType(tabId: number, text: string | undefined): Promise<ToolOutput> {
    if (!text) {
      throw new ToolError('The "type" action requires a "text" parameter', 'computer');
    }

    const result = await injectAndExecute(tabId, 'typeText', { text });
    const response = result as { success: boolean; error?: string };
    if (!response.success) {
      throw new ToolError(response.error ?? 'Type action failed', 'computer');
    }

    return {
      content: [{ type: 'text', text: `Typed text successfully.` }],
    };
  }

  private async handleKey(tabId: number, keys: string | undefined, repeat: number): Promise<ToolOutput> {
    if (!keys) {
      throw new ToolError('The "key" action requires a "text" parameter with key names', 'computer');
    }

    const result = await injectAndExecute(tabId, 'keyPress', {
      keys,
      repeat,
    });

    const response = result as { success: boolean; error?: string };
    if (!response.success) {
      throw new ToolError(response.error ?? 'Key press failed', 'computer');
    }

    return {
      content: [{ type: 'text', text: `Pressed key(s): ${keys}${repeat > 1 ? ` (x${repeat})` : ''}` }],
    };
  }

  private async handleScroll(tabId: number, input: ToolInput): Promise<ToolOutput> {
    const coordinate = input.coordinate as number[] | undefined;
    const direction = input.scroll_direction as string | undefined;
    const amount = (input.scroll_amount as number) ?? 3;

    if (!direction) {
      throw new ToolError('The "scroll" action requires a "scroll_direction" parameter', 'computer');
    }

    const result = await injectAndExecute(tabId, 'scroll', {
      coordinate,
      direction,
      amount,
    });

    const response = result as { success: boolean; error?: string };
    if (!response.success) {
      throw new ToolError(response.error ?? 'Scroll action failed', 'computer');
    }

    return {
      content: [
        { type: 'text', text: `Scrolled ${direction} by ${amount} ticks.` },
      ],
    };
  }

  private async handleHover(tabId: number, input: ToolInput): Promise<ToolOutput> {
    const coordinate = input.coordinate as number[] | undefined;
    const ref = input.ref as string | undefined;

    if (!coordinate && !ref) {
      throw new ToolError('The "hover" action requires either "coordinate" or "ref"', 'computer');
    }

    const result = await injectAndExecute(tabId, 'mouseAction', {
      action: 'hover',
      coordinate,
      ref,
    });

    const response = result as { success: boolean; error?: string };
    if (!response.success) {
      throw new ToolError(response.error ?? 'Hover action failed', 'computer');
    }

    return {
      content: [{ type: 'text', text: 'Hovered successfully.' }],
    };
  }

  private async handleDrag(tabId: number, input: ToolInput): Promise<ToolOutput> {
    const startCoordinate = input.start_coordinate as number[] | undefined;
    const endCoordinate = input.coordinate as number[] | undefined;

    if (!startCoordinate || !endCoordinate) {
      throw new ToolError(
        'The "left_click_drag" action requires both "start_coordinate" and "coordinate" (end position)',
        'computer',
      );
    }

    const result = await injectAndExecute(tabId, 'drag', {
      startCoordinate,
      endCoordinate,
    });

    const response = result as { success: boolean; error?: string };
    if (!response.success) {
      throw new ToolError(response.error ?? 'Drag action failed', 'computer');
    }

    return {
      content: [
        {
          type: 'text',
          text: `Dragged from (${startCoordinate[0]}, ${startCoordinate[1]}) to (${endCoordinate[0]}, ${endCoordinate[1]}).`,
        },
      ],
    };
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.replace(/^data:image\/png;base64,/, ''));
      };
      reader.onerror = () => reject(new ToolError('Failed to convert blob to base64', 'computer'));
      reader.readAsDataURL(blob);
    });
  }
}
