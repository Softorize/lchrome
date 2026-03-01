export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

export class ProviderError extends AppError {
  constructor(message: string, public readonly provider: string, details?: unknown) {
    super(message, `PROVIDER_${provider.toUpperCase()}`, details);
    this.name = 'ProviderError';
  }
}

export class ToolError extends AppError {
  constructor(message: string, public readonly toolName: string, details?: unknown) {
    super(message, `TOOL_${toolName.toUpperCase()}`, details);
    this.name = 'ToolError';
  }
}

export class TransportError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'TRANSPORT_ERROR', details);
    this.name = 'TransportError';
  }
}

export class AuthError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 'AUTH_ERROR', details);
    this.name = 'AuthError';
  }
}

export class RateLimitError extends AppError {
  constructor(
    message: string,
    public readonly retryAfter?: number,
    details?: unknown,
  ) {
    super(message, 'RATE_LIMIT', details);
    this.name = 'RateLimitError';
  }
}
