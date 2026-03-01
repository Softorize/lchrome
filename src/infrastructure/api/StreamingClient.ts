import { Logger } from '@/core/logger/Logger';

export class StreamingClient {
  private logger = new Logger('StreamingClient');
  private abortController: AbortController | null = null;

  async *stream(
    url: string,
    body: unknown,
    headers: Record<string, string> = {},
  ): AsyncIterable<string> {
    this.abortController = new AbortController();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
      signal: this.abortController.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Stream request failed: ${response.status} ${errorText}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        yield decoder.decode(value, { stream: true });
      }
    } finally {
      reader.releaseLock();
      this.abortController = null;
    }
  }

  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  get isStreaming(): boolean {
    return this.abortController !== null;
  }
}
