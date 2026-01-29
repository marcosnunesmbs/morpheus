import { Telegraf } from 'telegraf';
import chalk from 'chalk';
import { DisplayManager } from '../runtime/display.js';
import { Agent } from '../runtime/agent.js';

export class TelegramAdapter {
  private bot: Telegraf | null = null;
  private isConnected = false;
  private display = DisplayManager.getInstance();
  private agent: Agent;

  constructor(agent: Agent) {
    this.agent = agent;
  }

  public async connect(token: string, allowedUsers: string[]): Promise<void> {
    if (this.isConnected) {
      this.display.log('Telegram adapter already connected.', { source: 'Telegram', level: 'warning' });
      return;
    }

    try {
      this.display.log('Connecting to Telegram...', { source: 'Telegram' });
      this.bot = new Telegraf(token);

      // Verify token/connection
      const me = await this.bot.telegram.getMe();
      this.display.log(`✓ Telegram Connected: @${me.username}`, { source: 'Telegram', level: 'success' });
      this.display.log(`Allowed Users: ${allowedUsers.join(', ')}`, { source: 'Telegram', level: 'info' });

      // Listen for messages
      this.bot.on('text', async (ctx) => {
        const user = ctx.from.username || ctx.from.first_name;
        const userId = ctx.from.id.toString();
        const text = ctx.message.text;

        // AUTH GUARD
        if (!this.isAuthorized(userId, allowedUsers)) {
          this.display.log(`Unauthorized access attempt by @${user} (ID: ${userId})`, { source: 'Telegram', level: 'warning' });
          return; // Silent fail for security
        }

        this.display.log(`@${user}: ${text}`, { source: 'Telegram' });

        try {
          // Send "typing" status
          await ctx.sendChatAction('typing');

          // Process with Agent
          const response = await this.agent.chat(text);
          
          if (response) {
            await ctx.reply(response);
            this.display.log(`Responded to @${user}`, { source: 'Telegram' });
          }
        } catch (error: any) {
          this.display.log(`Error processing message for @${user}: ${error.message}`, { source: 'Telegram', level: 'error' });
          try {
             await ctx.reply("Sorry, I encountered an error while processing your request.");
          } catch (e) {
             // Ignore reply error
          }
        }
      });
      
      this.bot.launch().catch((err) => {
          if (this.isConnected) {
             this.display.log(`Telegram bot error: ${err}`, { source: 'Telegram', level: 'error' });
          }
      });
      
      this.isConnected = true;

      process.once('SIGINT', () => this.disconnect());
      process.once('SIGTERM', () => this.disconnect());

    } catch (error: any) {
      this.display.log(`Failed to connect to Telegram: ${error.message}`, { source: 'Telegram', level: 'error' });
      this.isConnected = false;
      this.bot = null;
      throw error;
    }
  }

  private isAuthorized(userId: string, allowedUsers: string[]): boolean {
    return allowedUsers.includes(userId);
  }

  public async disconnect(): Promise<void> {
    if (!this.isConnected || !this.bot) {
      return;
    }

    this.display.log('Disconnecting Telegram...', { source: 'Telegram', level: 'warning' });
    try {
        this.bot.stop();
    } catch (e) {
        // Ignore stop errors
    }
    this.isConnected = false;
    this.bot = null;
    this.display.log(chalk.gray('Telegram disconnected.'), { source: 'Telegram' });
  }
}
