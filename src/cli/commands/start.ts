import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { scaffold } from '../../runtime/scaffold.js';
import { writePid, readPid, isProcessRunning, clearPid, checkStalePid } from '../../runtime/lifecycle.js';
import { ConfigManager } from '../../config/manager.js';
import { renderBanner } from '../utils/render.js';

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
      
      const config = ConfigManager.getInstance().get();
      
      console.log(chalk.green(`Morpheus Agent (${config.agent.name}) starting...`));
      console.log(chalk.gray(`PID: ${process.pid}`));
      if (options.ui) {
         console.log(chalk.blue(`Web UI enabled on port ${options.port}`));
      }

      // Handle graceful shutdown
      const shutdown = async (signal: string) => {
        console.log(`\n${signal} received. Shutting down...`);
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
