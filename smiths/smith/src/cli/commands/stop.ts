import { Command } from 'commander';
import { stopSmithAgent } from '../../runtime/lifecycle';

const program = new Command();

program
  .command('stop')
  .description('Stop the SMITH agent, shutting down active connections and processes.')
  .action(async () => {
    try {
      await stopSmithAgent();
      console.log('SMITH agent stopped successfully.');
    } catch (error) {
      console.error('Error stopping SMITH agent:', error);
    }
  });

export default program;