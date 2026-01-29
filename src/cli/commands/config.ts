import { Command } from 'commander';
import chalk from 'chalk';
import open from 'open';
import fs from 'fs-extra';
import { PATHS } from '../../config/paths.js';
import { scaffold } from '../../runtime/scaffold.js';

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
