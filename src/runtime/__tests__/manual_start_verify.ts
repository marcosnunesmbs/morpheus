
import { Agent } from '../agent.js';
import { MorpheusConfig } from '../../types/config.js';
import chalk from 'chalk';

const start = Date.now();

console.log(chalk.blue('Running Manual Start Verification...'));

const mockConfig: MorpheusConfig = {
  agent: { name: 'TestAgent', personality: 'Robot' },
  llm: { provider: 'openai', model: 'gpt-3.5-turbo', temperature: 0.1, api_key: 'sk-mock-key' },
  channels: {
    telegram: { enabled: false, allowedUsers: [] },
    discord: { enabled: false }
  },
  ui: { enabled: false, port: 3333 },
  logging: { enabled: false, level: 'info', retention: '1d' },
  audio: {
    provider: 'google',
    enabled: false,
    maxDurationSeconds: 60,
    supportedMimeTypes: ['audio/ogg']
  },
  memory: {
    limit: 100
  }
};

const run = async () => {
    try {
        console.log(chalk.gray('1. Instantiating Agent...'));
        const agent = new Agent(mockConfig);

        console.log(chalk.gray('2. Initializing Agent...'));
        await agent.initialize();

        const duration = (Date.now() - start) / 1000;
        console.log(chalk.green(`✓ Agent initialized successfully in ${duration}s`));
        
        if (duration > 5) {
            console.log(chalk.red(`✗ Startup took too long (> 5s)`));
            process.exit(1);
        }

        console.log(chalk.gray('3. Testing Initialization Check...'));
        try {
            await agent.chat('Hello');
            // This might fail if using real network, but we just want to ensure it tries
        } catch (e: any) {
            console.log(chalk.yellow(`Chat check: ${e.message}`)); 
            // Expected to fail with mock key on real network, that's fine for "Start" verification
        }

    } catch (error: any) {
        console.error(chalk.red('Verification Failed:'), error);
        process.exit(1);
    }
};

run();
