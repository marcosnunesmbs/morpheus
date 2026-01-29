import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { scaffold } from '../../runtime/scaffold.js';
import { writePid, readPid, isProcessRunning, clearPid, checkStalePid } from '../../runtime/lifecycle.js';
import { ConfigManager } from '../../config/manager.js';
import { renderBanner } from '../utils/render.js';
import { TelegramAdapter } from '../../channels/telegram.js';

export const startCommand = new Command('start')
  .description('Start the Morpheus agent')
  .option('--ui', 'Enable web UI', true)
  .option('--no-ui', 'Disable web UI')
  .option('-p, --port <number>', 'Port for web UI', '3333')
  .action(async (options) => {
    try {
      renderBanner();
      
      await scaffold(); // Ensure env exists
      
      // Cleanup stale PID first
      await checkStalePid();

      const existingPid = await readPid();
      if (existingPid !== null && isProcessRunning(existingPid)) {
        console.log(chalk.red(`Morpheus is already running (PID: ${existingPid})`));
        process.exit(1);
      }

      // Write current PID
      await writePid(process.pid);
      
      const configManager = ConfigManager.getInstance();
      const config = await configManager.load();
      
      console.log(chalk.green(`Morpheus Agent (${config.agent.name}) starting...`));
      console.log(chalk.gray(`PID: ${process.pid}`));
      if (options.ui) {
         console.log(chalk.blue(`Web UI enabled on port ${options.port}`));
      }

      const adapters: any[] = [];

      // Initialize Telegram
      if (config.channels.telegram.enabled) {
        if (config.channels.telegram.token) {
          const telegram = new TelegramAdapter();
          try {
            await telegram.connect(config.channels.telegram.token);
            adapters.push(telegram);
          } catch (e) {
             console.error(chalk.red('Failed to initialize Telegram adapter. Continuing...'));
          }
        } else {
          console.warn(chalk.yellow('Telegram enabled but no token provided. Skipping.'));
        }
      }

      // Handle graceful shutdown
      const shutdown = async (signal: string) => {
        // spinner.stop() if spinner is accessible or just log
        console.log(`\n${signal} received. Shutting down...`);
        
        for (const adapter of adapters) {
            await adapter.disconnect();
        }

        await clearPid();
        process.exit(0);
      };

      process.on('SIGINT', () => shutdown('SIGINT'));
      process.on('SIGTERM', () => shutdown('SIGTERM'));

      // Keep process alive (Mock Agent Loop)
      const spinner = ora('Agent active and listening...').start();
      
      // Prevent node from exiting
      setInterval(() => {
        // Heartbeat or background tasks would go here
      }, 5000);

    } catch (error: any) {
      console.error(chalk.red('Failed to start Morpheus:'), error.message);
      await clearPid();
      process.exit(1);
    }
  });
