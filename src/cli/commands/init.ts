import { Command } from 'commander';
import { input, select, password, confirm, checkbox } from '@inquirer/prompts';
import chalk from 'chalk';
import { ConfigManager } from '../../config/manager.js';
import { renderBanner } from '../utils/render.js';
import { DisplayManager } from '../../runtime/display.js';
import { SatiRepository } from '../../runtime/memory/sati/repository.js';
// import { scaffold } from '../../runtime/scaffold.js';

export const initCommand = new Command('init')
  .description('Initialize Morpheus configuration')
  .action(async () => {
    const display = DisplayManager.getInstance();
    renderBanner();
    
    const configManager = ConfigManager.getInstance();
    const currentConfig = await configManager.load();
    
    // Ensure directory exists - Handled by preAction hook
    // await scaffold();

    display.log(chalk.blue('Let\'s set up your Morpheus agent!'));
    
    try {
      const name = await input({
        message: 'Name your agent:',
        default: currentConfig.agent.name,
      });

      const personality = await input({
        message: 'Describe its personality:',
        default: currentConfig.agent.personality,
      });

      const provider = await select({
        message: 'Select LLM Provider:',
        choices: [
          { name: 'OpenAI', value: 'openai' },
          { name: 'Anthropic', value: 'anthropic' },
          { name: 'Ollama', value: 'ollama' },
          { name: 'Google Gemini', value: 'gemini' },
        ],
        default: currentConfig.llm.provider,
      });

      let defaultModel = 'gpt-3.5-turbo';
      switch(provider) {
          case 'openai': defaultModel = 'gpt-4o'; break;
          case 'anthropic': defaultModel = 'claude-3-5-sonnet-20240620'; break;
          case 'ollama': defaultModel = 'llama3'; break;
          case 'gemini': defaultModel = 'gemini-pro'; break;
      }
      
      if (provider === currentConfig.llm.provider) {
        defaultModel = currentConfig.llm.model;
      }

      const model = await input({
        message: 'Enter Model Name:',
        default: defaultModel,
      });

      let apiKey: string | undefined;
      const hasExistingKey = !!currentConfig.llm.api_key;
      const apiKeyMessage = hasExistingKey 
        ? 'Enter API Key (leave empty to preserve existing, or if using env vars):'
        : 'Enter API Key (leave empty if using env vars):';

      if (provider !== 'ollama') {
        apiKey = await password({
          message: apiKeyMessage,
        });
      }

      // Update config
      await configManager.set('agent.name', name);
      await configManager.set('agent.personality', personality);
      await configManager.set('llm.provider', provider);
      await configManager.set('llm.model', model);
      
      if (apiKey) {
        await configManager.set('llm.api_key', apiKey);
      }

      // Santi (Memory Agent) Configuration
      display.log(chalk.blue('\nSati (Memory Agent) Configuration'));
      const configureSanti = await select({
          message: 'Configure Sati separately?',
          choices: [
              { name: 'No (Use main LLM settings)', value: 'no' },
              { name: 'Yes', value: 'yes' },
          ],
          default: 'no',
      });

      let santiProvider = provider;
      let santiModel = model;
      let santiApiKey = apiKey;
      
      // If using main settings and no new key provided, use existing if available
      if (configureSanti === 'no' && !santiApiKey && hasExistingKey) {
          santiApiKey = currentConfig.llm.api_key;
      }

      if (configureSanti === 'yes') {
        santiProvider = await select({
            message: 'Select Sati LLM Provider:',
            choices: [
              { name: 'OpenAI', value: 'openai' },
              { name: 'Anthropic', value: 'anthropic' },
              { name: 'Ollama', value: 'ollama' },
              { name: 'Google Gemini', value: 'gemini' },
            ],
            default: currentConfig.santi?.provider || provider,
        });

        let defaultSantiModel = 'gpt-3.5-turbo';
        switch(santiProvider) {
            case 'openai': defaultSantiModel = 'gpt-4o'; break;
            case 'anthropic': defaultSantiModel = 'claude-3-5-sonnet-20240620'; break;
            case 'ollama': defaultSantiModel = 'llama3'; break;
            case 'gemini': defaultSantiModel = 'gemini-pro'; break;
        }

        if (santiProvider === currentConfig.santi?.provider) {
             defaultSantiModel = currentConfig.santi?.model || defaultSantiModel;
        }

        santiModel = await input({
            message: 'Enter Sati Model Name:',
            default: defaultSantiModel,
        });

        const hasExistingSantiKey = !!currentConfig.santi?.api_key;
        const santiKeyMsg = hasExistingSantiKey 
          ? 'Enter Sati API Key (leave empty to preserve existing):'
          : 'Enter Sati API Key:';
        
        const keyInput = await password({ message: santiKeyMsg });
        if (keyInput) {
            santiApiKey = keyInput;
        } else if (hasExistingSantiKey) {
            santiApiKey = currentConfig.santi?.api_key;
        } else {
             santiApiKey = undefined; // Ensure we don't accidentally carry over invalid state
        }
      }

      const memoryLimit = await input({
          message: 'Sati Memory Retrieval Limit (messages):',
          default: currentConfig.santi?.memory_limit?.toString() || '1000',
          validate: (val) => !isNaN(Number(val)) && Number(val) > 0 || 'Must be a positive number'
      });

      await configManager.set('santi.provider', santiProvider);
      await configManager.set('santi.model', santiModel);
      await configManager.set('santi.memory_limit', Number(memoryLimit));
      if (santiApiKey) {
        await configManager.set('santi.api_key', santiApiKey);
      }

      // Audio Configuration
      const audioEnabled = await confirm({
        message: 'Enable Audio Transcription? (Requires Gemini)',
        default: currentConfig.audio?.enabled || false,
      });

      let audioKey: string | undefined;
      let finalAudioEnabled = audioEnabled;

      if (audioEnabled) {
          if (provider === 'gemini') {
              display.log(chalk.gray('Using main Gemini API key for audio.'));
          } else {
              const hasExistingAudioKey = !!currentConfig.audio?.apiKey;
              const audioKeyMessage = hasExistingAudioKey 
                ? 'Enter Gemini API Key for Audio (leave empty to preserve existing):'
                : 'Enter Gemini API Key for Audio:';
              
              audioKey = await password({
                  message: audioKeyMessage,
              });

              // Check if we have a valid key (new or existing)
              const effectiveKey = audioKey || currentConfig.audio?.apiKey;
              
              if (!effectiveKey) {
                  display.log(chalk.yellow('Audio disabled: Missing Gemini API Key required when using non-Gemini LLM provider.'));
                  finalAudioEnabled = false;
              }
          }
      }

      await configManager.set('audio.enabled', finalAudioEnabled);
      if (audioKey) {
        await configManager.set('audio.apiKey', audioKey);
      }
      
      // External Channels Configuration
      const configureChannels = await confirm({
        message: 'Do you want to configure external channels?',
        default: currentConfig.channels.telegram?.enabled || false,
      });

      if (configureChannels) {
        const channels = await checkbox({
          message: 'Select channels to enable:',
          choices: [
            { 
              name: 'Telegram', 
              value: 'telegram', 
              checked: currentConfig.channels.telegram?.enabled || false 
            },
          ],
        });

        if (channels.includes('telegram')) {
          display.log(chalk.yellow('\n--- Telegram Configuration ---'));
          display.log(chalk.gray('1. Create a bot via @BotFather to get your token.'));
          display.log(chalk.gray('2. Get your User ID via @userinfobot.\n'));

          const hasExistingToken = !!currentConfig.channels.telegram?.token;
          const token = await password({ 
            message: hasExistingToken 
              ? 'Enter Telegram Bot Token (leave empty to preserve existing):' 
              : 'Enter Telegram Bot Token:',
            validate: (value) => {
              if (value.length > 0) return true;
              if (hasExistingToken) return true;
              return 'Token is required.';
            }
          });
          
          const defaultUsers = currentConfig.channels.telegram?.allowedUsers?.join(', ') || '';
          const allowedUsersInput = await input({ 
            message: 'Enter Allowed User IDs (comma separated):',
            default: defaultUsers,
            validate: (value) => value.length > 0 || 'At least one user ID is required for security.'
          });
          
          const allowedUsers = allowedUsersInput.split(',').map(id => id.trim()).filter(id => id.length > 0);

          await configManager.set('channels.telegram.enabled', true);
          if (token) {
            await configManager.set('channels.telegram.token', token);
          }
          await configManager.set('channels.telegram.allowedUsers', allowedUsers);
        }
      }

      // Initialize Sati Memory (Long-term memory)
      try {
        SatiRepository.getInstance().initialize();
        display.log(chalk.green('Long-term memory initialized.'));
      } catch (e: any) {
        display.log(chalk.yellow(`Warning: Could not initialize long-term memory: ${e.message}`));
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
