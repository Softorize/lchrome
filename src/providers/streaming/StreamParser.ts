import type { StreamChunk } from '@/types/ai-provider';

export type StreamFormat = 'sse' | 'ndjson';

export class StreamParser {
  private buffer = '';

  constructor(private format: StreamFormat = 'sse') {}

  *parse(raw: string): Iterable<string> {
    this.buffer += raw;

    if (this.format === 'sse') {
      yield* this.parseSSE();
    } else {
      yield* this.parseNDJSON();
    }
  }

  private *parseSSE(): Iterable<string> {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';

    let data = '';
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const content = line.slice(6).trim();
        if (content === '[DONE]') {
          if (data) yield data;
          data = '';
          continue;
        }
        data += content;
      } else if (line === '' && data) {
        yield data;
        data = '';
      }
    }
    if (data) {
      // Check if buffer is empty (end of stream)
      if (this.buffer === '') {
        yield data;
      } else {
        this.buffer = `data: ${data}\n${this.buffer}`;
      }
    }
  }

  private *parseNDJSON(): Iterable<string> {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        yield trimmed;
      }
    }
  }

  reset(): void {
    this.buffer = '';
  }
}

export class SSEParser extends StreamParser {
  constructor() {
    super('sse');
  }
}
