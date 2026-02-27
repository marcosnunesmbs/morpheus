import { Command } from 'commander';
import { startCommand } from './commands/start.js';
import { stopCommand } from './commands/stop.js';
import { statusCommand } from './commands/status.js';
import { registerCommand } from './commands/register.js';

const program = new Command();

program
  .name('smith')
  .description('CLI for managing SMITH agents')
  .version('0.1.0');

program
  .command('start')
  .description('Start the SMITH agent')
  .action(startCommand);

program
  .command('stop')
  .description('Stop the SMITH agent')
  .action(stopCommand);

program
  .command('status')
  .description('Get the current status of the SMITH agent')
  .action(statusCommand);

program
  .command('register')
  .description('Register the SMITH agent with the Morpheus daemon')
  .action(registerCommand);

program.parse(process.argv);