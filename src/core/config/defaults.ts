import type { ProviderConfig } from '@/types/ai-provider';

export const DEFAULT_PROVIDERS: Partial<ProviderConfig>[] = [
  {
    type: 'ollama',
    name: 'Ollama (Local)',
    baseUrl: 'http://localhost:11434',
    enabled: false,
  },
  {
    type: 'lmstudio',
    name: 'LM Studio (Local)',
    baseUrl: 'http://localhost:1234',
    enabled: false,
  },
  {
    type: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com',
    enabled: false,
  },
  {
    type: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com',
    enabled: false,
  },
  {
    type: 'google',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com',
    enabled: false,
  },
];

export const DEFAULT_SETTINGS = {
  theme: 'system' as 'light' | 'dark' | 'system',
  maxContextMessages: 50,
  defaultMaxTokens: 4096,
  defaultTemperature: 0.7,
  mcpEnabled: false,
  mcpWebSocketPort: 9222,
};

export const EXTENSION_NAME = 'OmniChrome';
export const EXTENSION_VERSION = '0.1.0';
