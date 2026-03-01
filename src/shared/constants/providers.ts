import type { ProviderType } from '@/types/ai-provider';

export const PROVIDER_LABELS: Record<ProviderType, string> = {
  ollama: 'Ollama',
  lmstudio: 'LM Studio',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google Gemini',
  'openai-compat': 'OpenAI Compatible',
};

export const PROVIDER_DEFAULTS: Record<ProviderType, { baseUrl: string; requiresKey: boolean }> = {
  ollama: { baseUrl: 'http://localhost:11434', requiresKey: false },
  lmstudio: { baseUrl: 'http://localhost:1234', requiresKey: false },
  openai: { baseUrl: 'https://api.openai.com', requiresKey: true },
  anthropic: { baseUrl: 'https://api.anthropic.com', requiresKey: true },
  google: { baseUrl: 'https://generativelanguage.googleapis.com', requiresKey: true },
  'openai-compat': { baseUrl: '', requiresKey: false },
};

export const PROVIDER_TYPES: ProviderType[] = [
  'ollama',
  'lmstudio',
  'openai',
  'anthropic',
  'google',
  'openai-compat',
];
