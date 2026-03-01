const STORAGE_KEY_PREFIX = 'omnichrome_secure_';
const ENCRYPTION_KEY_NAME = 'omnichrome-master-key';

export class SecureStorageService {
  private cryptoKey: CryptoKey | null = null;

  async store(key: string, value: string): Promise<void> {
    const encKey = await this.getOrCreateKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(value);

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      encKey,
      encoded,
    );

    const stored = {
      iv: Array.from(iv),
      data: Array.from(new Uint8Array(encrypted)),
    };

    await chrome.storage.local.set({
      [STORAGE_KEY_PREFIX + key]: stored,
    });
  }

  async retrieve(key: string): Promise<string | null> {
    const result = await chrome.storage.local.get(STORAGE_KEY_PREFIX + key);
    const stored = result[STORAGE_KEY_PREFIX + key];

    if (!stored) return null;

    try {
      const encKey = await this.getOrCreateKey();
      const iv = new Uint8Array(stored.iv);
      const data = new Uint8Array(stored.data);

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        encKey,
        data,
      );

      return new TextDecoder().decode(decrypted);
    } catch {
      return null;
    }
  }

  async remove(key: string): Promise<void> {
    await chrome.storage.local.remove(STORAGE_KEY_PREFIX + key);
  }

  async has(key: string): Promise<boolean> {
    const result = await chrome.storage.local.get(STORAGE_KEY_PREFIX + key);
    return STORAGE_KEY_PREFIX + key in result;
  }

  private async getOrCreateKey(): Promise<CryptoKey> {
    if (this.cryptoKey) return this.cryptoKey;

    const stored = await chrome.storage.local.get(ENCRYPTION_KEY_NAME);
    if (stored[ENCRYPTION_KEY_NAME]) {
      const keyData = new Uint8Array(stored[ENCRYPTION_KEY_NAME]);
      this.cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        'AES-GCM',
        false,
        ['encrypt', 'decrypt'],
      );
      return this.cryptoKey;
    }

    this.cryptoKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    );

    const exported = await crypto.subtle.exportKey('raw', this.cryptoKey);
    await chrome.storage.local.set({
      [ENCRYPTION_KEY_NAME]: Array.from(new Uint8Array(exported)),
    });

    return this.cryptoKey;
  }
}
