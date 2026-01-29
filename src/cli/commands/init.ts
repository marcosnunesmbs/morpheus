import { Command } from 'commander';
import { input, select, password } from '@inquirer/prompts';
import chalk from 'chalk';
import { ConfigManager } from '../../config/manager.js';
import { renderBanner } from '../utils/render.js';
import { DisplayManager } from '../../runtime/display.js';
import { scaffold } from '../../runtime/scaffold.js';

export const initCommand = new Command('init')
  .description('Initialize Morpheus configuration')
  .action(async () => {
    const display = DisplayManager.getInstance();
    renderBanner();
    
    // Ensure directory exists
    await scaffold();

    display.log(chalk.blue('Let\'s set up your Morpheus agent!'));
    
    try {
      const name = await input({
        message: 'Name your agent:',
        default: 'morpheus',
      });

      const personality = await input({
        message: 'Describe its personality:',
        default: 'helpful and concise',
      });

      const provider = await select({
        message: 'Select LLM Provider:',
        choices: [
          { name: 'OpenAI', value: 'openai' },
          { name: 'Anthropic', value: 'anthropic' },
          { name: 'Ollama', value: 'ollama' },
          { name: 'Google Gemini', value: 'gemini' },
        ],
      });

      let defaultModel = 'gpt-3.5-turbo';
      switch(provider) {
          case 'openai': defaultModel = 'gpt-4o'; break;
          case 'anthropic': defaultModel = 'claude-3-5-sonnet-20240620'; break;
          case 'ollama': defaultModel = 'llama3'; break;
          case 'gemini': defaultModel = 'gemini-pro'; break;
      }

      const model = await input({
        message: 'Enter Model Name:',
        default: defaultModel,
      });

      let apiKey: string | undefined;
      if (provider !== 'ollama') {
        apiKey = await password({
          message: 'Enter API Key (leave empty if using env vars):',
        });
      }

      const configManager = ConfigManager.getInstance();
      
      // Update config
      await configManager.set('agent.name', name);
      await configManager.set('agent.personality', personality);
      await configManager.set('llm.provider', provider);
      await configManager.set('llm.model', model);
      
      if (apiKey) {
        await configManager.set('llm.api_key', apiKey);
      }
      
      display.log(chalk.green('\nConfiguration saved successfully!'));
      display.log(chalk.cyan(`Run 'morpheus start' to launch ${name}.`));
      
    } catch (error: any) {
        if (error instanceof Error && error.message.includes('force closed')) {
            display.log(chalk.yellow('\nSetup cancelled.'));
            return;
        }
        display.log(chalk.red('\nFailed to save configuration: ' + error.message));
    }
  });
