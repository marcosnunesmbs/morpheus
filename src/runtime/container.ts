/**
 * ServiceContainer — Composition Root
 *
 * Simple typed registry for application services (ports).
 * Configured once at startup in start.ts. No DI framework magic —
 * just a Map with type-safe get/register.
 *
 * Usage:
 *   // Registration (start.ts):
 *   ServiceContainer.register('notifier', new ChannelNotifierAdapter());
 *
 *   // Consumption:
 *   const notifier = ServiceContainer.get<INotifier>('notifier');
 */
export class ServiceContainer {
  private static readonly services = new Map<string, unknown>();

  /** Register a service under a given key. Overwrites if already registered. */
  static register<T>(key: string, service: T): void {
    ServiceContainer.services.set(key, service);
  }

  /**
   * Retrieve a registered service.
   * @throws if the key is not registered.
   */
  static get<T>(key: string): T {
    const service = ServiceContainer.services.get(key);
    if (service === undefined) {
      throw new Error(`ServiceContainer: "${key}" is not registered. Did you call register() in start.ts?`);
    }
    return service as T;
  }

  /** Returns true if a service is registered under the given key. */
  static has(key: string): boolean {
    return ServiceContainer.services.has(key);
  }

  /** Remove all registered services (useful in tests). */
  static reset(): void {
    ServiceContainer.services.clear();
  }
}

/**
 * Well-known service keys — use these constants to avoid typo bugs.
 */
export const SERVICE_KEYS = {
  notifier: 'notifier',
  taskEnqueuer: 'taskEnqueuer',
  chatHistory: 'chatHistory',
  providerFactory: 'providerFactory',
  auditEmitter: 'auditEmitter',
} as const;

export type ServiceKey = typeof SERVICE_KEYS[keyof typeof SERVICE_KEYS];
