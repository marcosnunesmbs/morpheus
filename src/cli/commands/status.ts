import { Command } from 'commander';
import chalk from 'chalk';
import { readPid, isProcessRunning, checkStalePid } from '../../runtime/lifecycle.js';

export const statusCommand = new Command('status')
  .description('Check the status of the Morpheus agent')
  .action(async () => {
    try {
      await checkStalePid();
      const pid = await readPid();

      if (pid && isProcessRunning(pid)) {
        console.log(chalk.green(`Morpheus is running (PID: ${pid})`));
      } else {
        console.log(chalk.gray('Morpheus is stopped.'));
      }
    } catch (error: any) {
      console.error(chalk.red('Failed to check status:'), error.message);
      process.exit(1);
    }
  });
