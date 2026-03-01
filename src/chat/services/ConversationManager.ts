import type { Conversation } from '../store/chatSlice';

const STORAGE_KEY = 'omnichrome_conversations';
const MAX_CONVERSATIONS = 100;

export class ConversationManager {
  async saveConversation(conversation: Conversation): Promise<void> {
    const conversations = await this.listConversations();
    const existingIndex = conversations.findIndex((c) => c.id === conversation.id);

    const updated = { ...conversation, updatedAt: Date.now() };

    if (existingIndex >= 0) {
      conversations[existingIndex] = updated;
    } else {
      conversations.unshift(updated);
    }

    // Trim to max
    const trimmed = conversations.slice(0, MAX_CONVERSATIONS);

    await chrome.storage.local.set({ [STORAGE_KEY]: trimmed });
  }

  async loadConversation(id: string): Promise<Conversation | null> {
    const conversations = await this.listConversations();
    return conversations.find((c) => c.id === id) ?? null;
  }

  async listConversations(): Promise<Conversation[]> {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const conversations = (result[STORAGE_KEY] ?? []) as Conversation[];
    // Sort by most recently updated
    return conversations.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async deleteConversation(id: string): Promise<void> {
    const conversations = await this.listConversations();
    const filtered = conversations.filter((c) => c.id !== id);
    await chrome.storage.local.set({ [STORAGE_KEY]: filtered });
  }

  async clearAll(): Promise<void> {
    await chrome.storage.local.remove(STORAGE_KEY);
  }

  /**
   * Generate a title for a conversation based on the first user message.
   */
  static generateTitle(firstMessage: string): string {
    const trimmed = firstMessage.trim();
    if (trimmed.length <= 50) return trimmed;
    return trimmed.substring(0, 47) + '...';
  }
}
