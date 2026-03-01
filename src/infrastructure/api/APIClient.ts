import { Logger } from '@/core/logger/Logger';
import { AppError, AuthError, RateLimitError } from '@/core/errors/AppError';

export interface APIClientConfig {
  baseUrl: string;
  headers?: Record<string, string>;
  timeout?: number;
}

export class APIClient {
  private logger: Logger;

  constructor(private config: APIClientConfig) {
    this.logger = new Logger('APIClient');
  }

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(path, this.config.baseUrl);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }
    return this.request<T>('GET', url.toString());
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const url = new URL(path, this.config.baseUrl);
    return this.request<T>('POST', url.toString(), body);
  }

  async request<T>(method: string, url: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timeout = this.config.timeout ?? 30000;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new AppError('Request timed out', 'TIMEOUT');
      }
      throw new AppError(
        error instanceof Error ? error.message : 'Network error',
        'NETWORK_ERROR',
        error,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async streamPost(
    path: string,
    body: unknown,
    signal?: AbortSignal,
  ): Promise<ReadableStream<Uint8Array>> {
    const url = new URL(path, this.config.baseUrl);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    if (!response.body) {
      throw new AppError('No response body for stream', 'STREAM_ERROR');
    }

    return response.body;
  }

  updateConfig(config: Partial<APIClientConfig>): void {
    this.config = { ...this.config, ...config };
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    let errorBody: string;
    try {
      errorBody = await response.text();
    } catch {
      errorBody = 'Unable to read error body';
    }

    if (response.status === 401 || response.status === 403) {
      throw new AuthError(`Authentication failed: ${response.statusText}`, errorBody);
    }

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('retry-after') || '60', 10);
      throw new RateLimitError('Rate limit exceeded', retryAfter, errorBody);
    }

    throw new AppError(
      `HTTP ${response.status}: ${response.statusText}`,
      `HTTP_${response.status}`,
      errorBody,
    );
  }
}
