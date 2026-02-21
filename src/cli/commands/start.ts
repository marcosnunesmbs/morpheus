import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs-extra';
import { confirm } from '@inquirer/prompts';
import { scaffold } from '../../runtime/scaffold.js';
import { DisplayManager } from '../../runtime/display.js';
import { writePid, readPid, isProcessRunning, clearPid, checkStalePid, killProcess, waitForProcessDeath } from '../../runtime/lifecycle.js';
import { ConfigManager } from '../../config/manager.js';
import { renderBanner } from '../utils/render.js';
import { TelegramAdapter } from '../../channels/telegram.js';
import { WebhookDispatcher } from '../../runtime/webhooks/dispatcher.js';
import { PATHS } from '../../config/paths.js';
import { Oracle } from '../../runtime/oracle.js';
import { ProviderError } from '../../runtime/errors.js';
import { HttpServer } from '../../http/server.js';
import { getVersion } from '../utils/version.js';
import { startSessionEmbeddingScheduler } from '../../runtime/session-embedding-scheduler.js';
import { TaskWorker } from '../../runtime/tasks/worker.js';
import { TaskNotifier } from '../../runtime/tasks/notifier.js';
import { TaskDispatcher } from '../../runtime/tasks/dispatcher.js';

export const startCommand = new Command('start')
  .description('Start the Morpheus agent')
  .option('--ui', 'Enable web UI', true)
  .option('--no-ui', 'Disable web UI')
  .option('-p, --port <number>', 'Port for web UI', '3333')
  .option('-y, --yes', 'Automatically answer yes to prompts')
  .action(async (options) => {
    const display = DisplayManager.getInstance();

    try {
      renderBanner(getVersion());

      await scaffold(); // Ensure env exists

      // Cleanup stale PID first
      await checkStalePid();


      const existingPid = await readPid();
      // Guard: skip if the stored PID is our own (container restart PID reuse scenario)
      if (existingPid !== null && existingPid !== process.pid && isProcessRunning(existingPid)) {
        display.log(chalk.yellow(`Morpheus is already running (PID: ${existingPid})`));

        let shouldKill = options.yes;

        if (!shouldKill) {
          try {
            shouldKill = await confirm({
              message: 'Do you want to stop the running instance and start a new one?',
              default: false,
            });
          } catch (error) {
            // User cancelled (Ctrl+C)
            display.log(chalk.gray('\nCancelled'));
            process.exit(1);
          }
        }

        if (shouldKill) {
          display.log(chalk.cyan(`Stopping existing process (PID: ${existingPid})...`));
          const killed = killProcess(existingPid);
          if (killed) {
            display.log(chalk.green('Terminated'));
            await clearPid();
            // Wait up to 5 s for the process to actually die before continuing
            const died = await waitForProcessDeath(existingPid, 5000);
            if (!died) {
              display.log(chalk.yellow('Warning: process may still be running. Proceeding anyway.'));
            }
          } else {
            display.log(chalk.red('Failed to stop the process'));
            await clearPid();
            process.exit(1);
          }
        } else {
          display.log(chalk.gray('Use a different port or stop the running instance manually'));
          process.exit(0);
        }
      }

      // Always remove any leftover PID file before writing the new one.
      // Guards against PID reuse on Linux where a stale PID may coincidentally
      // belong to an unrelated process, causing checkStalePid to keep it.
      await clearPid();

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

      display.log(chalk.green(`Morpheus Agent (${config.agent.name}) starting...`));
      display.log(chalk.gray(`PID: ${process.pid}`));
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
            // Wire Telegram adapter to webhook dispatcher for proactive notifications
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

      // Start Background Services
      startSessionEmbeddingScheduler();
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
      display.log(chalk.red('Failed to start Morpheus:'), { source: 'Zaion' });
      display.log(chalk.white(error.message), { source: 'Zaion' });
      await clearPid();
      process.exit(1);
    }
  });
