export type MessageType =
  // Provider messages
  | 'provider:ping'
  | 'provider:list-models'
  | 'provider:complete'
  | 'provider:stream'
  | 'provider:abort'
  // Tool messages
  | 'tool:execute'
  | 'tool:list'
  | 'tool:schemas'
  // Content script messages
  | 'cs:read-page'
  | 'cs:find-element'
  | 'cs:interact'
  | 'cs:form-input'
  | 'cs:get-text'
  | 'cs:inject'
  // MCP messages
  | 'mcp:request'
  | 'mcp:response'
  // Tab management
  | 'tab:create'
  | 'tab:context'
  | 'tab:screenshot'
  | 'tab:navigate'
  // Debug messages
  | 'debug:console'
  | 'debug:network'
  | 'debug:attach'
  | 'debug:detach'
  // Settings
  | 'settings:get'
  | 'settings:set';

export interface ExtensionMessage<T = unknown> {
  type: MessageType;
  id: string;
  payload: T;
  source?: 'sidebar' | 'popup' | 'content-script' | 'background' | 'native' | 'mcp';
  tabId?: number;
}

export interface ExtensionResponse<T = unknown> {
  id: string;
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface StreamMessage {
  type: 'stream:chunk' | 'stream:done' | 'stream:error';
  id: string;
  chunk?: import('./ai-provider').StreamChunk;
  error?: string;
}

export interface ContentScriptMessage {
  type: string;
  action: string;
  payload: unknown;
  requestId: string;
}
