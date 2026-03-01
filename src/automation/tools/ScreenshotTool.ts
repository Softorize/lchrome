import type { ITool } from './ITool';
import type { ToolSchema, ToolInput, ToolOutput, ToolContext } from '@/types/automation';
import { ToolError } from '@/core/errors/AppError';

export class ScreenshotTool implements ITool {
  readonly schema: ToolSchema = {
    name: 'screenshot',
    description:
      'Take a screenshot of the visible area of a tab. Optionally capture a specific region for closer inspection (zoom).',
    inputSchema: {
      type: 'object',
      properties: {
        tabId: {
          type: 'number',
          description: 'The ID of the tab to capture.',
        },
        region: {
          type: 'array',
          description:
            'Optional rectangular region to capture [x0, y0, x1, y1] in pixels from the viewport origin. Returns a cropped/zoomed view of that area.',
          items: { type: 'number' },
        },
      },
      required: ['tabId'],
    },
  };

  async execute(input: ToolInput, _context: ToolContext): Promise<ToolOutput> {
    const tabId = input.tabId as number;
    const region = input.region as number[] | undefined;

    try {
      // Get the tab to find its window
      const tab = await chrome.tabs.get(tabId);
      if (!tab.windowId) {
        throw new ToolError('Tab has no associated window', 'screenshot');
      }

      // Capture the visible tab in the tab's window
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: 'png',
        quality: 100,
      });

      // If a region is specified, crop the image using an OffscreenCanvas
      if (region && region.length === 4) {
        const [x0, y0, x1, y1] = region;
        const width = x1 - x0;
        const height = y1 - y0;

        if (width <= 0 || height <= 0) {
          throw new ToolError(
            'Invalid region: width and height must be positive',
            'screenshot',
          );
        }

        const croppedDataUrl = await this.cropImage(dataUrl, x0, y0, width, height);

        const base64Data = croppedDataUrl.replace(/^data:image\/png;base64,/, '');
        return {
          content: [
            {
              type: 'image',
              data: base64Data,
              mimeType: 'image/png',
            },
          ],
        };
      }

      // Return the full screenshot
      const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
      return {
        content: [
          {
            type: 'image',
            data: base64Data,
            mimeType: 'image/png',
          },
        ],
      };
    } catch (error) {
      if (error instanceof ToolError) throw error;
      throw new ToolError(
        `Failed to take screenshot: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'screenshot',
      );
    }
  }

  private async cropImage(
    dataUrl: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ): Promise<string> {
    // Fetch the image as a blob and use OffscreenCanvas for cropping
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const imageBitmap = await createImageBitmap(blob, x, y, width, height);

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new ToolError('Failed to create canvas context', 'screenshot');
    }
    ctx.drawImage(imageBitmap, 0, 0);
    imageBitmap.close();

    const resultBlob = await canvas.convertToBlob({ type: 'image/png' });
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new ToolError('Failed to read cropped image', 'screenshot'));
      reader.readAsDataURL(resultBlob);
    });
  }
}
