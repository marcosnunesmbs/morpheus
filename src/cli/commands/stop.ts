import { Command } from 'commander';
import chalk from 'chalk';
import { readPid, isProcessRunning, clearPid, checkStalePid } from '../../runtime/lifecycle.js';

export const stopCommand = new Command('stop')
  .description('Stop the running Morpheus agent')
  .action(async () => {
    try {
      await checkStalePid();
      const pid = await readPid();

      if (!pid) {
        console.log(chalk.yellow('Morpheus is not running.'));
        return;
      }

      if (!isProcessRunning(pid)) {
        console.log(chalk.yellow('Morpheus is not running (stale PID file cleaned).'));
        await clearPid();
        return;
      }

      process.kill(pid, 'SIGTERM');
      console.log(chalk.green(`Sent stop signal to Morpheus (PID: ${pid}).`));
      
      // Optional: Wait to ensure it clears the PID file
      // For now, we assume the agent handles its own cleanup via SIGTERM handler
      
    } catch (error: any) {
      console.error(chalk.red('Failed to stop Morpheus:'), error.message);
      process.exit(1);
    }
  });
