import { Telegraf } from 'telegraf';
import chalk from 'chalk';
import { DisplayManager } from '../runtime/display.js';

export class TelegramAdapter {
  private bot: Telegraf | null = null;
  private isConnected = false;
  private display = DisplayManager.getInstance();

  public async connect(token: string): Promise<void> {
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

      // Listen for messages
      this.bot.on('text', (ctx) => {
        const user = ctx.from.username || ctx.from.first_name;
        const text = ctx.message.text;
        this.display.log(`@${user}: ${text}`, { source: 'Telegram' });
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
