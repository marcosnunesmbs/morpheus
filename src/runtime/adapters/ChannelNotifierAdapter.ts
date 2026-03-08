/**
 * Adapter: ChannelNotifierAdapter
 *
 * Implements INotifier using ChannelRegistry.
 * Allows tools and dispatchers to send notifications without
 * importing ChannelRegistry directly.
 */
import type { INotifier } from '../ports/INotifier.js';
import { ChannelRegistry } from '../../channels/registry.js';

export class ChannelNotifierAdapter implements INotifier {
  async sendToUser(channel: string, userId: string, text: string): Promise<void> {
    await ChannelRegistry.sendToUser(channel, userId, text);
  }

  async broadcast(text: string): Promise<void> {
    await ChannelRegistry.broadcast(text);
  }
}
