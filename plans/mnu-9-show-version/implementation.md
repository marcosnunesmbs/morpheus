# MNU-9: Show Version

## Goal
Display the package.json version in the CLI banner, UI footer, and a dedicated dashboard card.

## Prerequisites
Make sure that the use is currently on the `marcosnunesmbs/mnu-9-show-version` branch before beginning implementation.
If not, move them to the correct branch. If the branch does not exist, create it from main.

### Step-by-Step Instructions

#### Step 1: Add Version to CLI Banner
- [x] Update the banner renderer to accept an optional version string and render it below the tagline.
- [x] Copy and paste code below into src/cli/utils/render.ts:

```typescript
import chalk from 'chalk';
import figlet from 'figlet';

export function renderBanner(version?: string) {
  const art = figlet.textSync('Morpheus', {
    font: 'Standard',
    horizontalLayout: 'default',
    verticalLayout: 'default',
  });
  console.log(chalk.cyanBright(art));
  console.log(chalk.gray('  The Local-First AI Agent specialized in Coding\n'));
  console.log(chalk.gray(`  v${version || 'unknown'}\n`));
}
```

- [x] Add a shared CLI version helper and use it from both CLI entry and start command.
- [x] Copy and paste code below into src/cli/utils/version.ts:

```typescript
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

export const getVersion = () => {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    // Assuming dist/cli/index.js -> package.json is 2 levels up
    const pkgPath = join(__dirname, '../../package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version;
  } catch (e) {
    return '0.1.0';
  }
};
```

- [x] Use the shared helper in the CLI entry point.
- [x] Copy and paste code below into src/cli/index.ts:

```typescript
import { Command } from 'commander';
import { startCommand } from './commands/start.js';
import { stopCommand } from './commands/stop.js';
import { statusCommand } from './commands/status.js';
import { configCommand } from './commands/config.js';
import { doctorCommand } from './commands/doctor.js';
import { initCommand } from './commands/init.js';
import { scaffold } from '../runtime/scaffold.js';
import { getVersion } from './utils/version.js';

export async function cli() {
  const program = new Command();

  program
    .name('morpheus')
    .description('Morpheus CLI Agent')
    .version(getVersion());

  program.hook('preAction', async () => {
    await scaffold();
  });

  program.addCommand(initCommand);
  program.addCommand(startCommand);
  program.addCommand(stopCommand);
  program.addCommand(statusCommand);
  program.addCommand(configCommand);
  program.addCommand(doctorCommand);

  program.parse(process.argv);
}

// Support direct execution via tsx
if (import.meta.url.startsWith('file:') && (process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('cli/index.js'))) {
  cli();
}
```

- [x] Pass the version into the banner during `start`.
- [x] Copy and paste code below into src/cli/commands/start.ts:

```typescript
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

export const startCommand = new Command('start')
  .description('Start the Morpheus agent')
  .option('--ui', 'Enable web UI', true)
  .option('--no-ui', 'Disable web UI')
  .option('-p, --port <number>', 'Port for web UI', '3333')
  .action(async (options) => {
    const display = DisplayManager.getInstance();

    try {
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
      
      display.log(chalk.green(`Morpheus Agent (${config.agent.name}) starting...`));
      display.log(chalk.gray(`PID: ${process.pid}`));
      if (options.ui) {
         display.log(chalk.blue(`Web UI enabled to port ${options.port}`));
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
          display.log(chalk.red(`\nProvider Error (${err.provider}):`));
          display.log(chalk.white(err.message));
          if (err.suggestion) {
             display.log(chalk.yellow(`Tip: ${err.suggestion}`));
          }
        } else {
          display.log(chalk.red('\nOracle initialization failed:'));
          display.log(chalk.white(err.message));
          
          if (err.message.includes('API Key')) {
             display.log(chalk.yellow('Tip: Check your API key in configuration or environment variables.'));
          }
        }
        await clearPid();
        process.exit(1);
      }

      const adapters: any[] = [];
      let httpServer: HttpServer | undefined;

      // Initialize Web UI
      if (options.ui && config.ui.enabled) {
        try {
          httpServer = new HttpServer();
          // Use CLI port if provided and valid, otherwise fallback to config or default
          const port = parseInt(options.port) || config.ui.port || 3333;
          httpServer.start(port);
        } catch (e: any) {
          display.log(chalk.red(`Failed to start Web UI: ${e.message}`));
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
            adapters.push(telegram);
          } catch (e) {
             display.log(chalk.red('Failed to initialize Telegram adapter. Continuing...'));
          }
        } else {
          display.log(chalk.yellow('Telegram enabled but no token provided. Skipping.'));
        }
      }

      // Handle graceful shutdown
      const shutdown = async (signal: string) => {
        display.stopSpinner();
        display.log(`\n${signal} received. Shutting down...`);
        
        if (httpServer) {
          httpServer.stop();
        }

        for (const adapter of adapters) {
            await adapter.disconnect();
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
      console.error(chalk.red('Failed to start Morpheus:'), error.message);
      await clearPid();
      process.exit(1);
    }
  });
```

##### Step 1 Verification Checklist
- [x] Run `npm start -- start` and confirm the banner shows the figlet art, tagline, and a gray version line like `v0.2.0`.
- [x] No build errors.

#### Step 1 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.

#### Step 2: Display Version in UI Footer
- [ ] Make the version label in the footer more visible while keeping it on the right side.
- [ ] Copy and paste code below into src/ui/src/components/Footer.tsx:

```tsx
import { useStatus } from '@/lib/api';

export function Footer() {
  const { data: status } = useStatus();

  return (
    <footer className="h-8 bg-azure-bg dark:bg-zinc-950 border-t border-azure-border dark:border-matrix-primary flex items-center px-4 text-xs justify-between select-none z-10 shrink-0">
      <div className="flex gap-4">
        <span className={status ? 'text-azure-primary dark:text-matrix-highlight' : 'text-red-500'}>
           ● {status?.status.toUpperCase() || 'OFFLINE'}
        </span>
        <span>PID: {status?.pid || '-'}</span>
        <span>UPTIME: {status ? Math.floor(status.uptimeSeconds / 60) + 'm' : '-'}</span>
      </div>
      <div className="flex gap-4">
        <span className="font-mono text-azure-text-secondary dark:text-matrix-secondary opacity-90">v{status?.projectVersion || '0.0.0'}</span>
        <span className="opacity-70">{status?.agentName || 'Morpheus'}</span>
      </div>
    </footer>
  );
}
```

##### Step 2 Verification Checklist
- [ ] Run `npm start -- start --ui` and confirm the footer shows `v{version}` on the right side.
- [ ] Verify readability in both light and dark themes.
- [ ] No build errors.

#### Step 2 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.

#### Step 3: Add Version Card to Dashboard
- [ ] Add a dedicated VERSION card while keeping Node version visible as its own card.
- [ ] Copy and paste code below into src/ui/src/pages/Dashboard.tsx:

```tsx
import { useStatus } from '@/lib/api';
import { Activity, Cpu, Clock, Brain, Box, Package } from 'lucide-react';
import { motion } from 'framer-motion';
import { StatCard } from '../components/dashboard/StatCard';
import { UsageStatsWidget } from '../components/dashboard/UsageStatsWidget';

export function Dashboard() {
  const { data: status } = useStatus();

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <motion.div 
      className="space-y-8"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={item}>
        <h2 className="text-2xl font-bold text-azure-primary dark:text-matrix-highlight mb-2">SYSTEM STATUS</h2>
        <p className="text-azure-text-secondary dark:text-matrix-secondary opacity-80">Overview of the Morpheus agent runtime.</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="Agent Status" 
          value={status?.status.toUpperCase() || 'CONNECTING...'} 
          icon={Activity}
          subValue={status ? `PID: ${status.pid}` : ''}
        />
        <StatCard 
          title="Uptime" 
          value={status ? `${Math.floor(status.uptimeSeconds / 60)}m` : '-'} 
          icon={Clock}
          subValue={status ? `${status.uptimeSeconds.toFixed(0)} seconds` : ''}
        />
        <StatCard 
          title="VERSION" 
          value={`v${status?.projectVersion || '0.0.0'}`} 
          icon={Package}
          subValue="Current Release"
        />
        <StatCard 
          title="Node Version" 
          value={status?.nodeVersion || '-'} 
          icon={Cpu}
          subValue="Runtime"
        />
        <StatCard 
          title="Provider" 
          value={status?.llmProvider?.toUpperCase() || '-'} 
          icon={Brain}
          subValue="LLM Inference Engine"
        />
        <StatCard 
          title="Model" 
          value={status?.llmModel || '-'} 
          icon={Box}
          subValue="Active Model"
        />
        <UsageStatsWidget />
      </div>
    </motion.div>
  );
}
```

##### Step 3 Verification Checklist
- [ ] Run `npm start -- start --ui` and confirm a VERSION card appears in the dashboard grid.
- [ ] Ensure Node Version still displays in its own card.
- [ ] Verify layout responsiveness with the extra card.
- [ ] No build errors.

#### Step 3 STOP & COMMIT
**STOP & COMMIT:** Agent must stop here and wait for the user to test, stage, and commit the change.
