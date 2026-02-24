import { Client, GatewayIntentBits, Partials, Events, ChannelType } from 'discord.js';
import chalk from 'chalk';
import { Oracle } from '../runtime/oracle.js';
import { SQLiteChatMessageHistory } from '../runtime/memory/sqlite.js';
import { DisplayManager } from '../runtime/display.js';

export class DiscordAdapter {
  private client: Client | null = null;
  private oracle: Oracle;
  private allowedUsers: string[] = [];
  private rateLimitMap = new Map<string, number>();
  private display = DisplayManager.getInstance();
  private history = new SQLiteChatMessageHistory({ sessionId: '' });

  private readonly RATE_LIMIT_MS = 3000;

  constructor(oracle: Oracle) {
    this.oracle = oracle;
  }

  public async connect(token: string, allowedUsers: string[]): Promise<void> {
    this.allowedUsers = allowedUsers;

    this.client = new Client({
      intents: [
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
      ],
      partials: [Partials.Channel, Partials.Message],
    });

    this.client.once(Events.ClientReady, (readyClient) => {
      this.display.log(
        chalk.green(`✓ Discord bot online: @${readyClient.user.tag}`),
        { source: 'Discord' }
      );
      this.display.log(
        `Allowed Users: ${allowedUsers.length > 0 ? allowedUsers.join(', ') : '(none)'}`,
        { source: 'Discord', level: 'info' }
      );
    });

    this.client.on(Events.ShardError, (error) => {
      this.display.log(`Discord WebSocket error: ${error.message}`, { source: 'Discord', level: 'error' });
    });

    this.client.on(Events.MessageCreate, async (message) => {
      if (message.author.bot) return;
      if (message.channel.type !== ChannelType.DM) return;

      const userId = message.author.id;

      if (!this.isAuthorized(userId)) {
        this.display.log(
          `Unauthorized access attempt by ${message.author.tag} (ID: ${userId})`,
          { source: 'Discord', level: 'warning' }
        );
        return;
      }

      if (this.isRateLimited(userId)) {
        try {
          await message.channel.send('Please wait a moment before sending another message.');
        } catch {
          // ignore
        }
        return;
      }

      const text = message.content;
      this.display.log(`${message.author.tag}: ${text}`, { source: 'Discord' });

      try {
        const sessionId = `discord-${userId}`;
        await this.oracle.setSessionId(sessionId);

        const response = await this.oracle.chat(text, undefined, false, {
          origin_channel: 'discord',
          session_id: sessionId,
          origin_message_id: message.id,
          origin_user_id: userId,
        });

        if (response) {
          const chunks = this.chunkText(response);
          for (const chunk of chunks) {
            await message.channel.send(chunk);
          }
          this.display.log(
            `Responded to ${message.author.tag}`,
            { source: 'Discord' }
          );
        }
      } catch (error: any) {
        this.display.log(
          `Error processing message from ${message.author.tag}: ${error.message}`,
          { source: 'Discord', level: 'error' }
        );
        try {
          await message.channel.send(
            `Sorry, I encountered an error: ${error.message}`
          );
        } catch {
          // ignore
        }
      }
    });

    // login() validates the token and initiates the WS connection.
    // ClientReady fires asynchronously — we don't block on it.
    await this.client.login(token);
  }

  public async disconnect(): Promise<void> {
    if (!this.client) return;
    this.display.log('Disconnecting Discord...', { source: 'Discord', level: 'warning' });
    try {
      this.client.destroy();
    } catch {
      // ignore
    }
    this.client = null;
    this.display.log(chalk.gray('Discord disconnected.'), { source: 'Discord' });
  }

  /**
   * Sends a message to all allowed users via DM.
   */
  public async sendMessage(text: string): Promise<void> {
    if (!this.client) {
      this.display.log('Cannot send message: Discord bot not connected.', { source: 'Discord', level: 'warning' });
      return;
    }

    if (this.allowedUsers.length === 0) {
      this.display.log('No allowed Discord users configured — skipping notification.', { source: 'Discord', level: 'warning' });
      return;
    }

    for (const userId of this.allowedUsers) {
      await this.sendMessageToUser(userId, text);
    }
  }

  public async sendMessageToUser(userId: string, text: string): Promise<void> {
    if (!this.client) return;
    try {
      const user = await this.client.users.fetch(userId);
      const chunks = this.chunkText(text);
      for (const chunk of chunks) {
        await user.send(chunk);
      }
    } catch (error: any) {
      this.display.log(
        `Failed to send message to Discord user ${userId}: ${error.message}`,
        { source: 'Discord', level: 'error' }
      );
    }
  }

  private isAuthorized(userId: string): boolean {
    return this.allowedUsers.includes(userId);
  }

  private isRateLimited(userId: string): boolean {
    const now = Date.now();
    const last = this.rateLimitMap.get(userId);
    if (last !== undefined && now - last < this.RATE_LIMIT_MS) return true;
    this.rateLimitMap.set(userId, now);
    return false;
  }

  private chunkText(text: string, limit = 2000): string[] {
    if (text.length <= limit) return [text];
    const chunks: string[] = [];
    let remaining = text;
    while (remaining.length > limit) {
      let splitAt = remaining.lastIndexOf('\n', limit - 1);
      if (splitAt < limit / 4) splitAt = remaining.lastIndexOf(' ', limit - 1);
      if (splitAt <= 0) splitAt = limit;
      chunks.push(remaining.slice(0, splitAt).trimEnd());
      remaining = remaining.slice(splitAt).trimStart();
    }
    if (remaining) chunks.push(remaining);
    return chunks.filter(Boolean);
  }
}
