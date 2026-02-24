import { DisplayManager } from '../runtime/display.js';

/**
 * Common interface every channel adapter must implement.
 * Adding a new channel = implement this + ChannelRegistry.register() in start.ts.
 */
export interface IChannelAdapter {
  /** Unique channel identifier, e.g. 'telegram', 'discord' */
  readonly channel: string;
  /** Broadcast a message to all users of this channel */
  sendMessage(text: string): Promise<void>;
  /** Send a message to a specific user on this channel */
  sendMessageToUser(userId: string, text: string): Promise<void>;
  disconnect(): Promise<void>;
}

/**
 * Central registry for all active channel adapters.
 * TaskDispatcher, ChronosWorker and WebhookDispatcher use this
 * instead of holding direct adapter references.
 */
export class ChannelRegistry {
  private static readonly adapters = new Map<string, IChannelAdapter>();
  private static display = DisplayManager.getInstance();

  static register(adapter: IChannelAdapter): void {
    ChannelRegistry.adapters.set(adapter.channel, adapter);
    ChannelRegistry.display.log(
      `Channel adapter registered: ${adapter.channel}`,
      { source: 'ChannelRegistry', level: 'info' },
    );
  }

  static unregister(channel: string): void {
    ChannelRegistry.adapters.delete(channel);
  }

  static get(channel: string): IChannelAdapter | undefined {
    return ChannelRegistry.adapters.get(channel);
  }

  static getAll(): IChannelAdapter[] {
    return [...ChannelRegistry.adapters.values()];
  }

  /** Broadcast to every registered adapter */
  static async broadcast(text: string): Promise<void> {
    const results = await Promise.allSettled(
      ChannelRegistry.getAll().map((a) => a.sendMessage(text)),
    );
    for (const result of results) {
      if (result.status === 'rejected') {
        ChannelRegistry.display.log(
          `Broadcast error: ${result.reason?.message ?? result.reason}`,
          { source: 'ChannelRegistry', level: 'error' },
        );
      }
    }
  }

  /** Send to a specific user on a specific channel */
  static async sendToUser(channel: string, userId: string, text: string): Promise<void> {
    const adapter = ChannelRegistry.get(channel);
    if (!adapter) {
      ChannelRegistry.display.log(
        `sendToUser: no adapter registered for channel "${channel}"`,
        { source: 'ChannelRegistry', level: 'warning' },
      );
      return;
    }
    await adapter.sendMessageToUser(userId, text);
  }
}
