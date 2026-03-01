export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class Logger {
  private level: number;

  constructor(
    private readonly prefix: string,
    level: LogLevel = 'info',
  ) {
    this.level = LOG_LEVELS[level];
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.level <= LOG_LEVELS.debug) {
      console.debug(`[${this.prefix}]`, message, ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.level <= LOG_LEVELS.info) {
      console.info(`[${this.prefix}]`, message, ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.level <= LOG_LEVELS.warn) {
      console.warn(`[${this.prefix}]`, message, ...args);
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.level <= LOG_LEVELS.error) {
      console.error(`[${this.prefix}]`, message, ...args);
    }
  }

  setLevel(level: LogLevel): void {
    this.level = LOG_LEVELS[level];
  }

  child(subPrefix: string): Logger {
    return new Logger(`${this.prefix}:${subPrefix}`);
  }
}

export const logger = new Logger('OmniChrome', 'debug');
