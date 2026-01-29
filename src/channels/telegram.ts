import { Telegraf } from 'telegraf';
import chalk from 'chalk';

export class TelegramAdapter {
  private bot: Telegraf | null = null;
  private isConnected = false;

  public async connect(token: string): Promise<void> {
    if (this.isConnected) {
      console.log(chalk.yellow('Telegram adapter already connected.'));
      return;
    }

    try {
      console.log(chalk.cyan('Connecting to Telegram...'));
      this.bot = new Telegraf(token);

      // Verify token/connection
      const me = await this.bot.telegram.getMe();
      console.log(chalk.green(`✓ Telegram Connected: @${me.username}`));

      // Listen for messages
      this.bot.on('text', (ctx) => {
        const user = ctx.from.username || ctx.from.first_name;
        const text = ctx.message.text;
        console.log(chalk.blue(`[Telegram] @${user}: ${text}`));
      });
      
      // Start polling
      // We don't await launch() forever, but we need to handle potential start errors
      // launch() returns a promise that resolves when the bot stops? No.
      // Actually launch() waits for the bot to be stopped.
      // So we should NOT await it here if we want to return from connect().
      // But we should catch setup errors.
      
      this.bot.launch().catch((err) => {
          if (this.isConnected) { // Only log if we thought we were connected
             console.error(chalk.red('Telegram bot error:'), err);
          }
      });
      
      this.isConnected = true;

      // Enable graceful stop
      process.once('SIGINT', () => this.disconnect());
      process.once('SIGTERM', () => this.disconnect());

    } catch (error: any) {
      console.error(chalk.red('Failed to connect to Telegram:'), error.message);
      this.isConnected = false;
      this.bot = null;
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.isConnected || !this.bot) {
      return;
    }

    console.log(chalk.yellow('Disconnecting Telegram...'));
    try {
        this.bot.stop();
    } catch (e) {
        // Ignore stop errors
    }
    this.isConnected = false;
    this.bot = null;
    console.log(chalk.gray('Telegram disconnected.'));
  }
}
