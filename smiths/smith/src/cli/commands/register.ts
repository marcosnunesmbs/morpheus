import { Command } from 'commander';
import { registerSmithAgent } from '../../runtime/lifecycle';

const program = new Command();

program
  .command('register')
  .description('Register the SMITH agent with the Morpheus daemon')
  .action(async () => {
    try {
      const result = await registerSmithAgent();
      console.log('SMITH agent registered successfully:', result);
    } catch (error) {
      console.error('Failed to register SMITH agent:', error);
    }
  });

export default program;