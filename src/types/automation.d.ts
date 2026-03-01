export interface ToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, PropertySchema>;
    required?: string[];
  };
}

export interface PropertySchema {
  type: string;
  description?: string;
  enum?: string[];
  items?: PropertySchema;
  properties?: Record<string, PropertySchema>;
  required?: string[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
}

export interface ToolInput {
  [key: string]: unknown;
}

export interface ToolOutput {
  content: ToolOutputContent[];
  isError?: boolean;
}

export interface ToolOutputContent {
  type: 'text' | 'image';
  text?: string;
  data?: string;
  mimeType?: string;
}

export interface ToolContext {
  tabId: number;
  tabGroupId?: number;
  sender?: chrome.runtime.MessageSender;
}

export interface AccessibilityNode {
  ref: string;
  role: string;
  name?: string;
  value?: string;
  description?: string;
  checked?: boolean;
  selected?: boolean;
  expanded?: boolean;
  disabled?: boolean;
  focused?: boolean;
  children?: AccessibilityNode[];
  bounds?: { x: number; y: number; width: number; height: number };
}

export interface ElementRef {
  ref: string;
  selector: string;
  tagName: string;
  role?: string;
  text?: string;
  ariaLabel?: string;
  bounds: { x: number; y: number; width: number; height: number };
}

export interface ConsoleMessage {
  type: 'log' | 'warn' | 'error' | 'info' | 'debug';
  text: string;
  timestamp: number;
  url?: string;
  lineNumber?: number;
}

export interface NetworkRequest {
  id: string;
  url: string;
  method: string;
  status?: number;
  statusText?: string;
  type: string;
  timestamp: number;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  size?: number;
  duration?: number;
}
