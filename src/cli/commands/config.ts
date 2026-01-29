import { Command } from 'commander';
import chalk from 'chalk';
import open from 'open';
import fs from 'fs-extra';
import { PATHS } from '../../config/paths.js';
import { scaffold } from '../../runtime/scaffold.js';
import { ConfigManager } from '../../config/manager.js';

function parseValue(value: string): any {
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  
  if (!Number.isNaN(Number(value)) && value.trim() !== '') {
    return Number(value);
  }
  return value;
}

export const configCommand = new Command('config')
  .description('View or edit configuration')
  .option('-e, --edit', 'Open config file in default editor')
  .action(async (options) => {
    try {
      await scaffold(); // Ensure config exits

      if (options.edit) {
        console.log(chalk.cyan(`Opening config file: ${PATHS.config}`));
        await open(PATHS.config);
      } else {
        console.log(chalk.bold('Configuration File:'), chalk.cyan(PATHS.config));
        console.log(chalk.gray('---'));
        if (await fs.pathExists(PATHS.config)) {
            const content = await fs.readFile(PATHS.config, 'utf8');
            console.log(content);
        } else {
            console.log(chalk.yellow('Config file not found (scaffold should have created it).'));
        }
        console.log(chalk.gray('---'));
      }
    } catch (error: any) {
      console.error(chalk.red('Failed to handle config command:'), error.message);
      process.exit(1);
    }
  });

configCommand.command('set')
  .description('Set a configuration value')
  .argument('<key>', 'Configuration key (e.g. channels.telegram.enabled)')
  .argument('<value>', 'Value to set')
  .action(async (key, value) => {
    try {
      await scaffold(); // Ensure config loads 
      const manager = ConfigManager.getInstance();
      await manager.load();
      
      const parsedValue = parseValue(value);
      
      try {
        await manager.set(key, parsedValue);
        console.log(chalk.green(`✓ Set ${key} = ${parsedValue}`));
      } catch (e: any) {
        // Fallback: If Zod fails, maybe it was a string that looked like a number?
        if (typeof parsedValue === 'number') {
            try {
                await manager.set(key, value); // Try original string
                console.log(chalk.green(`✓ Set ${key} = "${value}" (treated as string)`));
                return;
            } catch (ignored) {}
        }
        throw e;
      }
    } catch (error: any) {
      console.error(chalk.red('Failed to set config:'), error.message || error);
        if (error.issues) {
            // Zod error
            console.error(chalk.red('Validation issues:'), JSON.stringify(error.issues, null, 2));
        }
      process.exit(1);
    }
  });

