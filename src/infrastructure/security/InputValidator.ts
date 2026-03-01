export class InputValidator {
  static sanitizeHtml(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  static isValidUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  static isValidTabId(tabId: unknown): tabId is number {
    return typeof tabId === 'number' && Number.isInteger(tabId) && tabId > 0;
  }

  static isValidCoordinate(coord: unknown): coord is [number, number] {
    return (
      Array.isArray(coord) &&
      coord.length === 2 &&
      typeof coord[0] === 'number' &&
      typeof coord[1] === 'number'
    );
  }

  static isValidRef(ref: unknown): ref is string {
    return typeof ref === 'string' && /^ref_\d+$/.test(ref);
  }

  static truncate(str: string, maxLength: number): string {
    if (str.length <= maxLength) return str;
    return str.slice(0, maxLength - 3) + '...';
  }

  static validateEnum<T extends string>(value: unknown, validValues: T[]): T | null {
    if (typeof value === 'string' && validValues.includes(value as T)) {
      return value as T;
    }
    return null;
  }
}
