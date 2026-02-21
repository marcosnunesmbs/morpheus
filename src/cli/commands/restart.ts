import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs-extra';
import { scaffold } from '../../runtime/scaffold.js';
import { DisplayManager } from '../../runtime/display.js';
import { writePid, readPid, isProcessRunning, clearPid, checkStalePid } from '../../runtime/lifecycle.js';
import { ConfigManager } from '../../config/manager.js';
import { renderBanner } from '../utils/render.js';
import { TelegramAdapter } from '../../channels/telegram.js';
import { PATHS } from '../../config/paths.js';
import { Oracle } from '../../runtime/oracle.js';
import { ProviderError } from '../../runtime/errors.js';
import { HttpServer } from '../../http/server.js';
import { getVersion } from '../utils/version.js';
import { TaskWorker } from '../../runtime/tasks/worker.js';
import { TaskNotifier } from '../../runtime/tasks/notifier.js';
import { TaskDispatcher } from '../../runtime/tasks/dispatcher.js';
import { WebhookDispatcher } from '../../runtime/webhooks/dispatcher.js';

export const restartCommand = new Command('restart')
  .description('Restart the Morpheus agent')
  .option('--ui', 'Enable web UI', true)
  .option('--no-ui', 'Disable web UI')
  .option('-p, --port <number>', 'Port for web UI', '3333')
  .action(async (options) => {
    const display = DisplayManager.getInstance();

    try {
      // First, try to stop the current process
      display.log(chalk.blue('Stopping current Morpheus process...'));

      await checkStalePid();
      const pid = await readPid();

      if (pid) {
        if (isProcessRunning(pid)) {
          process.kill(pid, 'SIGTERM');
          display.log(chalk.green(`Sent stop signal to Morpheus (PID: ${pid}).`));

          // Wait a bit for the process to terminate
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          display.log(chalk.yellow('Current process not running, continuing with restart...'));
          await clearPid();
        }
      } else {
        display.log(chalk.yellow('No running process found, continuing with restart...'));
      }

      // Now start a new process
      display.log(chalk.blue('Starting new Morpheus process...'));

      renderBanner(getVersion());

      await scaffold(); // Ensure env exists

      // Cleanup stale PID first
      await checkStalePid();

      const existingPid = await readPid();
      if (existingPid !== null && isProcessRunning(existingPid)) {
        display.log(chalk.red(`Morpheus is already running (PID: ${existingPid})`));
        process.exit(1);
      }

      // Check config existence
      if (!await fs.pathExists(PATHS.config)) {
        display.log(chalk.yellow("Configuration not found."));
        display.log(chalk.cyan("Please run 'morpheus init' first to set up your agent."));
        process.exit(1);
      }

      // Write current PID
      await writePid(process.pid);

      const configManager = ConfigManager.getInstance();
      const config = await configManager.load();

      // Initialize persistent logging
      await display.initialize(config.logging);

      display.log(chalk.green(`Morpheus Agent (${config.agent.name}) starting...`), { source: 'Zaion' });
      display.log(chalk.gray(`PID: ${process.pid}`), { source: 'Zaion' });
      if (options.ui) {
        display.log(chalk.blue(`Web UI enabled to port ${options.port}`), { source: 'Zaion' });
      }

      // Initialize Oracle
      const oracle = new Oracle(config);
      try {
        display.startSpinner(`Initializing ${config.llm.provider} oracle...`);
        await oracle.initialize();
        display.stopSpinner();
        display.log(chalk.green('✓ Oracle initialized'), { source: 'Oracle' });
      } catch (err: any) {
        display.stopSpinner();
        if (err instanceof ProviderError) {
          display.log(chalk.red(`\nProvider Error (${err.provider}):`), { source: 'Oracle' });
          display.log(chalk.white(err.message), { source: 'Oracle' });
          if (err.suggestion) {
            display.log(chalk.yellow(`Tip: ${err.suggestion}`), { source: 'Oracle' });
          }
        } else {
          display.log(chalk.red('\nOracle initialization failed:'), { source: 'Oracle' });
          display.log(chalk.white(err.message), { source: 'Oracle' });

          if (err.message.includes('API Key')) {
            display.log(chalk.yellow('Tip: Check your API key in configuration or environment variables.'), { source: 'Oracle' });
          }
        }
        await clearPid();
        process.exit(1);
      }

      const adapters: any[] = [];
      let httpServer: HttpServer | undefined;
      const taskWorker = new TaskWorker();
      const taskNotifier = new TaskNotifier();
      const asyncTasksEnabled = config.runtime?.async_tasks?.enabled !== false;

      // Initialize Web UI
      if (options.ui && config.ui.enabled) {
        try {
          httpServer = new HttpServer(oracle);
          // Use CLI port if provided and valid, otherwise fallback to config or default
          const port = parseInt(options.port) || config.ui.port || 3333;
          httpServer.start(port);
        } catch (e: any) {
          display.log(chalk.red(`Failed to start Web UI: ${e.message}`), { source: 'Zaion' });
        }
      }

      // Initialize Telegram
      if (config.channels.telegram.enabled) {
        if (config.channels.telegram.token) {
          const telegram = new TelegramAdapter(oracle);
          try {
            await telegram.connect(
              config.channels.telegram.token,
              config.channels.telegram.allowedUsers || []
            );
            WebhookDispatcher.setTelegramAdapter(telegram);
            TaskDispatcher.setTelegramAdapter(telegram);
            adapters.push(telegram);
          } catch (e) {
            display.log(chalk.red('Failed to initialize Telegram adapter. Continuing...'), { source: 'Zaion' });
          }
        } else {
          display.log(chalk.yellow('Telegram enabled but no token provided. Skipping.'), { source: 'Zaion' });
        }
      }

      if (asyncTasksEnabled) {
        taskWorker.start();
        taskNotifier.start();
      }

      // Handle graceful shutdown
      const shutdown = async (signal: string) => {
        display.stopSpinner();
        display.log(`\n${signal} received. Shutting down...`, { source: 'Zaion' });

        if (httpServer) {
          httpServer.stop();
        }

        for (const adapter of adapters) {
          await adapter.disconnect();
        }
        if (asyncTasksEnabled) {
          taskWorker.stop();
          taskNotifier.stop();
        }

        await clearPid();
        process.exit(0);
      };

      process.on('SIGINT', () => shutdown('SIGINT'));
      process.on('SIGTERM', () => shutdown('SIGTERM'));

      // Allow ESC to exit
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', (key: string) => {
          // ESC or Ctrl+C
          if (key === '\u001B' || key === '\u0003') {
            shutdown('User Quit');
          }
        });
      }

      // Keep process alive (Mock Agent Loop)
      display.startSpinner('Agent active and listening... (Press ctrl+c to stop)');

      // Prevent node from exiting
      setInterval(() => {
        // Heartbeat or background tasks would go here
      }, 5000);

    } catch (error: any) {
      display.stopSpinner();
      display.log(chalk.red('Failed to restart Morpheus:'), { source: 'Zaion' });
      display.log(chalk.white(error.message), { source: 'Zaion' });
      await clearPid();
      process.exit(1);
    }
  });
