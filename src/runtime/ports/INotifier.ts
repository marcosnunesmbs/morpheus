/**
 * Port: INotifier
 *
 * Abstraction for sending messages to users and channels.
 * Decouples tools and dispatchers from ChannelRegistry.
 */
export interface INotifier {
  /** Send a message to a specific user on a specific channel. */
  sendToUser(channel: string, userId: string, text: string): Promise<void>;

  /** Broadcast a message to all registered channels. */
  broadcast(text: string): Promise<void>;
}
