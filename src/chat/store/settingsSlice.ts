import { create } from 'zustand';

export type Theme = 'dark' | 'light';

export interface SettingsState {
  theme: Theme;
  maxContextMessages: number;
  defaultMaxTokens: number;
  defaultTemperature: number;
  mcpEnabled: boolean;

  updateSettings: (updates: Partial<Omit<SettingsState, 'updateSettings'>>) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: 'dark',
  maxContextMessages: 50,
  defaultMaxTokens: 4096,
  defaultTemperature: 0.7,
  mcpEnabled: true,

  updateSettings: (updates) => {
    set((state) => ({ ...state, ...updates }));
  },
}));
