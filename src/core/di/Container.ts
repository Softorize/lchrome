type Factory<T> = () => T;

interface Registration<T> {
  factory: Factory<T>;
  singleton: boolean;
  instance?: T;
}

export class Container {
  private registrations = new Map<string, Registration<unknown>>();

  register<T>(key: string, factory: Factory<T>, singleton = true): void {
    this.registrations.set(key, { factory, singleton });
  }

  resolve<T>(key: string): T {
    const registration = this.registrations.get(key);
    if (!registration) {
      throw new Error(`No registration found for key: ${key}`);
    }

    if (registration.singleton) {
      if (!registration.instance) {
        registration.instance = registration.factory();
      }
      return registration.instance as T;
    }

    return registration.factory() as T;
  }

  has(key: string): boolean {
    return this.registrations.has(key);
  }

  clear(): void {
    this.registrations.clear();
  }
}

export const container = new Container();
