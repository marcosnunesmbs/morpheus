import { Command } from 'commander';
import { startSmithAgent } from '../../runtime/lifecycle';

const program = new Command();

program
  .command('start')
  .description('Start the SMITH agent')
  .action(async () => {
    try {
      await startSmithAgent();
      console.log('SMITH agent started successfully.');
    } catch (error) {
      console.error('Failed to start SMITH agent:', error);
    }
  });

export default program;