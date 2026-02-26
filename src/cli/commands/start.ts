import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { confirm } from '@inquirer/prompts';
import { scaffold } from '../../runtime/scaffold.js';
import { DisplayManager } from '../../runtime/display.js';
import { writePid, readPid, isProcessRunning, clearPid, checkStalePid, killProcess, waitForProcessDeath } from '../../runtime/lifecycle.js';
import { ConfigManager } from '../../config/manager.js';
import { renderBanner } from '../utils/render.js';
import { TelegramAdapter } from '../../channels/telegram.js';
import { DiscordAdapter } from '../../channels/discord.js';
import { ChannelRegistry } from '../../channels/registry.js';
import { WebhookDispatcher } from '../../runtime/webhooks/dispatcher.js';
import { registerOracleForHotReload } from '../../runtime/hot-reload.js';
import { PATHS } from '../../config/paths.js';
import { Oracle } from '../../runtime/oracle.js';
import { ProviderError } from '../../runtime/errors.js';
import { HttpServer } from '../../http/server.js';
import { getVersion } from '../utils/version.js';
import { startSessionEmbeddingScheduler } from '../../runtime/session-embedding-scheduler.js';
import { TaskWorker } from '../../runtime/tasks/worker.js';
import { TaskNotifier } from '../../runtime/tasks/notifier.js';
import { ChronosWorker } from '../../runtime/chronos/worker.js';
import { ChronosRepository } from '../../runtime/chronos/repository.js';
import { SkillRegistry } from '../../runtime/skills/index.js';

// Load .env file explicitly in start command
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  try {
    const envConfig = fs.readFileSync(envPath, 'utf-8');
    envConfig.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;

      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        // Don't overwrite existing env vars
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
    console.log('[DEBUG] Loaded .env file from:', envPath);
  } catch (err) {
    console.error('[WARN] Failed to load .env:', err);
  }
}

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

      // Initialize SkillRegistry before Oracle (so skills are available in system prompt)
      try {
        const skillRegistry = SkillRegistry.getInstance();
        await skillRegistry.load();
        const loadedSkills = skillRegistry.getAll();
        const enabledCount = skillRegistry.getEnabled().length;
        display.log(chalk.green(`✓ Skills loaded: ${loadedSkills.length} total, ${enabledCount} enabled`), { source: 'Skills' });
      } catch (err: any) {
        display.log(chalk.yellow(`Skills initialization warning: ${err.message}`), { source: 'Skills' });
      }

      // Initialize Oracle
      const oracle = new Oracle(config);
      try {
        display.startSpinner(`Initializing ${config.llm.provider} oracle...`);
        await oracle.initialize();
        display.stopSpinner();
        display.log(chalk.green('✓ Oracle initialized'), { source: 'Oracle' });
        
        // Register Oracle for hot-reload
        registerOracleForHotReload(oracle);
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
      const chronosRepo = ChronosRepository.getInstance();
      const chronosWorker = new ChronosWorker(chronosRepo, oracle);
      ChronosWorker.setInstance(chronosWorker);

      // Initialize Web UI
      if (options.ui && config.ui.enabled) {
        try {
          httpServer = new HttpServer(oracle, chronosWorker);
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
            ChannelRegistry.register(telegram);
            adapters.push(telegram);
          } catch (e) {
            display.log(chalk.red('Failed to initialize Telegram adapter. Continuing...'), { source: 'Zaion' });
          }
        } else {
          display.log(chalk.yellow('Telegram enabled but no token provided. Skipping.'), { source: 'Zaion' });
        }
      }

      // Initialize Discord
      if (config.channels.discord.enabled) {
        if (config.channels.discord.token) {
          const discord = new DiscordAdapter(oracle);
          try {
            await discord.connect(
              config.channels.discord.token,
              config.channels.discord.allowedUsers || []
            );
            ChannelRegistry.register(discord);
            adapters.push(discord);
          } catch (e: any) {
            display.log(chalk.red(`Failed to initialize Discord adapter: ${e.message}`), { source: 'Zaion' });
          }
        } else {
          display.log(chalk.yellow('Discord enabled but no token provided. Skipping.'), { source: 'Zaion' });
        }
      }

      // Start Background Services
      startSessionEmbeddingScheduler();
      chronosWorker.start();
      if (asyncTasksEnabled) {
        taskWorker.start();
        taskNotifier.start();
      }

      // Recover webhook notifications stuck in 'pending' from previous runs
      WebhookDispatcher.recoverStale().catch((err: any) => {
        display.log(`Webhook recovery error: ${err.message}`, { source: 'Webhooks', level: 'error' });
      });

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
        chronosWorker.stop();
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
