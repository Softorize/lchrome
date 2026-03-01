import { Logger } from '@/core/logger/Logger';

export class ScreenshotService {
  private logger = new Logger('ScreenshotService');

  async captureTab(tabId: number): Promise<string> {
    try {
      const tab = await chrome.tabs.get(tabId);
      const windowId = tab.windowId;
      const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
        format: 'png',
        quality: 100,
      });
      return dataUrl;
    } catch (error) {
      this.logger.error('Failed to capture tab', error);
      throw error;
    }
  }

  async captureRegion(
    tabId: number,
    region: { x: number; y: number; width: number; height: number },
  ): Promise<string> {
    // Capture full page first, then crop via offscreen canvas
    const fullDataUrl = await this.captureTab(tabId);
    return this.cropImage(fullDataUrl, region);
  }

  private async cropImage(
    dataUrl: string,
    region: { x: number; y: number; width: number; height: number },
  ): Promise<string> {
    // Use OffscreenCanvas for cropping in service worker context
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob, region.x, region.y, region.width, region.height);

    const canvas = new OffscreenCanvas(region.width, region.height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);

    const croppedBlob = await canvas.convertToBlob({ type: 'image/png' });
    const arrayBuffer = await croppedBlob.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    return `data:image/png;base64,${base64}`;
  }
}
