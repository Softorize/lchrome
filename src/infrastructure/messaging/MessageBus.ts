import type { ExtensionMessage, ExtensionResponse, MessageType } from '@/types/messages';
import { Logger } from '@/core/logger/Logger';

type MessageHandler<T = unknown, R = unknown> = (
  payload: T,
  sender?: chrome.runtime.MessageSender,
) => Promise<R> | R;

export class MessageBus {
  private handlers = new Map<MessageType, MessageHandler>();
  private logger: Logger;

  constructor() {
    this.logger = new Logger('MessageBus');
    this.setupListener();
  }

  on<T = unknown, R = unknown>(type: MessageType, handler: MessageHandler<T, R>): void {
    this.handlers.set(type, handler as MessageHandler);
  }

  off(type: MessageType): void {
    this.handlers.delete(type);
  }

  async send<T = unknown, R = unknown>(
    type: MessageType,
    payload: T,
    tabId?: number,
  ): Promise<ExtensionResponse<R>> {
    const message: ExtensionMessage<T> = {
      type,
      id: crypto.randomUUID(),
      payload,
      tabId,
    };

    try {
      if (tabId) {
        return await chrome.tabs.sendMessage(tabId, message);
      }
      return await chrome.runtime.sendMessage(message);
    } catch (error) {
      this.logger.error(`Failed to send message ${type}`, error);
      return {
        id: message.id,
        success: false,
        error: {
          code: 'SEND_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  private setupListener(): void {
    chrome.runtime.onMessage.addListener(
      (message: ExtensionMessage, sender, sendResponse) => {
        const handler = this.handlers.get(message.type);
        if (!handler) {
          sendResponse({
            id: message.id,
            success: false,
            error: { code: 'NO_HANDLER', message: `No handler for ${message.type}` },
          });
          return false;
        }

        Promise.resolve(handler(message.payload, sender))
          .then((result) => {
            sendResponse({
              id: message.id,
              success: true,
              data: result,
            } as ExtensionResponse);
          })
          .catch((error) => {
            this.logger.error(`Handler error for ${message.type}`, error);
            sendResponse({
              id: message.id,
              success: false,
              error: {
                code: 'HANDLER_ERROR',
                message: error instanceof Error ? error.message : 'Unknown error',
              },
            } as ExtensionResponse);
          });

        return true; // Keep message channel open for async response
      },
    );
  }
}

export const messageBus = new MessageBus();
