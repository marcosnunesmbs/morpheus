import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigManager } from '../../config/manager.js';
import { SmithRegistry } from '../../runtime/smiths/registry.js';

export const smithsCommand = new Command('smiths')
  .description('Manage remote Smith agents')
  .action(async () => {
    // Default action: list all Smiths
    await ConfigManager.getInstance().load();
    const config = ConfigManager.getInstance().getSmithsConfig();

    if (!config.enabled) {
      console.log(chalk.yellow('⚠') + ' Smiths subsystem is disabled.');
      console.log(chalk.gray('  Enable it in zaion.yaml: smiths.enabled: true'));
      return;
    }

    if (config.entries.length === 0) {
      console.log(chalk.yellow('⚠') + ' No Smiths configured.');
      console.log(chalk.gray('  Add entries in zaion.yaml under smiths.entries'));
      return;
    }

    console.log(chalk.bold('Registered Smiths'));
    console.log(chalk.gray('═══════════════════'));

    for (const entry of config.entries) {
      const stateIcon = '⚪'; // Offline by default (not connected via CLI)
      console.log(`  ${stateIcon} ${chalk.cyan(entry.name)} — ${entry.host}:${entry.port}`);
    }

    console.log();
    console.log(chalk.gray(`  Execution mode: ${config.execution_mode}`));
    console.log(chalk.gray(`  Heartbeat: ${config.heartbeat_interval_ms}ms`));
    console.log(chalk.gray(`  Total: ${config.entries.length} smith(s)`));
  });

smithsCommand
  .command('list')
  .description('List all configured Smiths')
  .action(async () => {
    await ConfigManager.getInstance().load();
    const config = ConfigManager.getInstance().getSmithsConfig();

    if (config.entries.length === 0) {
      console.log('No Smiths configured.');
      return;
    }

    console.log(chalk.bold('Name            Host                    Port'));
    console.log(chalk.gray('────────────────────────────────────────────'));

    for (const entry of config.entries) {
      const name = entry.name.padEnd(16);
      const host = entry.host.padEnd(24);
      console.log(`${chalk.cyan(name)}${host}${entry.port}`);
    }
  });

smithsCommand
  .command('ping <name>')
  .description('Test connectivity to a Smith')
  .action(async (name: string) => {
    await ConfigManager.getInstance().load();
    const config = ConfigManager.getInstance().getSmithsConfig();

    const entry = config.entries.find(e => e.name === name);
    if (!entry) {
      console.log(chalk.red(`✗ Smith '${name}' not found in configuration.`));
      const available = config.entries.map(e => e.name).join(', ');
      if (available) console.log(chalk.gray(`  Available: ${available}`));
      process.exit(1);
      return;
    }

    console.log(chalk.gray(`Pinging ${entry.name} at ${entry.host}:${entry.port}...`));

    try {
      // Simple TCP connectivity check
      const { createConnection } = await import('net');
      const socket = createConnection({ host: entry.host, port: entry.port, timeout: 5000 });

      await new Promise<void>((resolve, reject) => {
        socket.on('connect', () => {
          const latency = Date.now();
          console.log(chalk.green('✓') + ` Smith '${name}' is reachable at ${entry.host}:${entry.port}`);
          socket.end();
          resolve();
        });
        socket.on('timeout', () => {
          socket.destroy();
          reject(new Error('Connection timeout'));
        });
        socket.on('error', (err) => {
          reject(err);
        });
      });
    } catch (err: any) {
      console.log(chalk.red('✗') + ` Smith '${name}' is unreachable: ${err.message}`);
      process.exit(1);
    }
  });

smithsCommand
  .command('remove <name>')
  .description('Remove a Smith from configuration')
  .action(async (name: string) => {
    const configManager = ConfigManager.getInstance();
    await configManager.load();
    const config = configManager.get();

    const entries = config.smiths?.entries ?? [];
    const idx = entries.findIndex(e => e.name === name);

    if (idx === -1) {
      console.log(chalk.red(`✗ Smith '${name}' not found in configuration.`));
      process.exit(1);
      return;
    }

    entries.splice(idx, 1);
    await configManager.save({
      ...config,
      smiths: { ...config.smiths!, entries },
    });

    console.log(chalk.green('✓') + ` Smith '${name}' removed from configuration.`);
  });
