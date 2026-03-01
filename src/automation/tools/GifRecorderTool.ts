import type { ITool } from './ITool';
import type { ToolSchema, ToolInput, ToolOutput, ToolContext } from '@/types/automation';
import { ToolError } from '@/core/errors/AppError';
import { Logger } from '@/core/logger/Logger';

interface RecordingState {
  isRecording: boolean;
  frames: Array<{ dataUrl: string; timestamp: number }>;
  intervalId: ReturnType<typeof setInterval> | null;
  tabId: number;
}

export class GifRecorderTool implements ITool {
  private logger = new Logger('GifRecorderTool');
  private recordings = new Map<number, RecordingState>();

  /** Interval between frame captures in milliseconds */
  private static readonly CAPTURE_INTERVAL_MS = 500;

  readonly schema: ToolSchema = {
    name: 'gif_recorder',
    description:
      'Manage GIF recording and export for browser automation sessions. Control when to start/stop recording browser actions, then export as an animated GIF. Start recording, take actions, stop recording, and export.',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description:
            'Action to perform: "start_recording" to begin capturing frames, "stop_recording" to stop capturing but keep frames, "export" to generate and download the GIF, "clear" to discard all frames.',
          enum: ['start_recording', 'stop_recording', 'export', 'clear'],
        },
        tabId: {
          type: 'number',
          description: 'The ID of the tab to record.',
        },
        filename: {
          type: 'string',
          description:
            'Optional filename for the exported GIF (default: "recording-[timestamp].gif"). Only used with the "export" action.',
        },
        download: {
          type: 'string',
          description:
            'Set to "true" for the "export" action to download the GIF in the browser.',
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
        case 'start_recording':
          return this.startRecording(tabId);
        case 'stop_recording':
          return this.stopRecording(tabId);
        case 'export':
          return this.exportGif(
            tabId,
            input.filename as string | undefined,
            input.download === 'true' || input.download === true,
          );
        case 'clear':
          return this.clearRecording(tabId);
        default:
          throw new ToolError(`Unknown GIF recorder action: ${action}`, 'gif_recorder');
      }
    } catch (error) {
      if (error instanceof ToolError) throw error;
      throw new ToolError(
        `GIF recorder action "${action}" failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'gif_recorder',
      );
    }
  }

  private async startRecording(tabId: number): Promise<ToolOutput> {
    // Stop any existing recording for this tab
    const existing = this.recordings.get(tabId);
    if (existing?.isRecording) {
      this.stopCapture(existing);
    }

    const state: RecordingState = {
      isRecording: true,
      frames: [],
      intervalId: null,
      tabId,
    };

    // Capture initial frame
    await this.captureFrame(state);

    // Start periodic capture
    state.intervalId = setInterval(async () => {
      if (state.isRecording) {
        await this.captureFrame(state);
      }
    }, GifRecorderTool.CAPTURE_INTERVAL_MS);

    this.recordings.set(tabId, state);

    return {
      content: [
        {
          type: 'text',
          text: `Started recording on tab ${tabId}. Take a screenshot immediately after to capture the initial state.`,
        },
      ],
    };
  }

  private async stopRecording(tabId: number): Promise<ToolOutput> {
    const state = this.recordings.get(tabId);
    if (!state) {
      throw new ToolError('No recording found for this tab', 'gif_recorder');
    }

    if (!state.isRecording) {
      return {
        content: [
          {
            type: 'text',
            text: `Recording on tab ${tabId} is already stopped. ${state.frames.length} frames captured.`,
          },
        ],
      };
    }

    // Capture final frame before stopping
    await this.captureFrame(state);
    this.stopCapture(state);

    return {
      content: [
        {
          type: 'text',
          text: `Stopped recording on tab ${tabId}. ${state.frames.length} frames captured. Use "export" to generate the GIF.`,
        },
      ],
    };
  }

  private async exportGif(
    tabId: number,
    filename?: string,
    download?: boolean,
  ): Promise<ToolOutput> {
    const state = this.recordings.get(tabId);
    if (!state || state.frames.length === 0) {
      throw new ToolError(
        'No frames to export. Start and stop a recording first.',
        'gif_recorder',
      );
    }

    // Stop recording if still active
    if (state.isRecording) {
      await this.captureFrame(state);
      this.stopCapture(state);
    }

    const effectiveFilename =
      filename ?? `recording-${Date.now()}.gif`;

    // Send frames to the tab for GIF encoding via content script
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content-scripts/content-script.js'],
      });
    } catch {
      /* may already be injected */
    }

    const frameDataUrls = state.frames.map((f) => f.dataUrl);

    const result = await chrome.tabs.sendMessage(tabId, {
      type: 'cs:action',
      action: 'encodeGif',
      payload: {
        frames: frameDataUrls,
        filename: effectiveFilename,
        download: download ?? true,
        delay: GifRecorderTool.CAPTURE_INTERVAL_MS,
      },
      requestId: crypto.randomUUID(),
    });

    const response = result as { success: boolean; error?: string; data?: string };
    if (!response.success) {
      throw new ToolError(
        response.error ?? 'Failed to encode GIF',
        'gif_recorder',
      );
    }

    // If the content script returned base64 GIF data, include it
    if (response.data) {
      return {
        content: [
          {
            type: 'text',
            text: `GIF exported as "${effectiveFilename}" with ${state.frames.length} frames.`,
          },
          {
            type: 'image',
            data: response.data,
            mimeType: 'image/gif',
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `GIF exported as "${effectiveFilename}" with ${state.frames.length} frames.${download ? ' Download initiated in browser.' : ''}`,
        },
      ],
    };
  }

  private clearRecording(tabId: number): ToolOutput {
    const state = this.recordings.get(tabId);
    if (state) {
      this.stopCapture(state);
      this.recordings.delete(tabId);
    }

    return {
      content: [
        {
          type: 'text',
          text: `Cleared recording data for tab ${tabId}.`,
        },
      ],
    };
  }

  private stopCapture(state: RecordingState): void {
    state.isRecording = false;
    if (state.intervalId !== null) {
      clearInterval(state.intervalId);
      state.intervalId = null;
    }
  }

  private async captureFrame(state: RecordingState): Promise<void> {
    try {
      const tab = await chrome.tabs.get(state.tabId);
      if (!tab.windowId) return;

      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: 'png',
        quality: 80,
      });

      state.frames.push({
        dataUrl,
        timestamp: Date.now(),
      });
    } catch (error) {
      this.logger.warn(
        `Failed to capture frame for tab ${state.tabId}`,
        error,
      );
    }
  }
}
