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
          { name: 'OpenRouter', value: 'openrouter' },
          { name: 'Ollama', value: 'ollama' },
          { name: 'Google Gemini', value: 'gemini' },
        ],
        default: currentConfig.llm.provider,
      });

      let defaultModel = 'gpt-3.5-turbo';
      switch(provider) {
          case 'openai': defaultModel = 'gpt-4o'; break;
          case 'anthropic': defaultModel = 'claude-3-5-sonnet-20240620'; break;
          case 'openrouter': defaultModel = 'openrouter/auto'; break;
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
      let apiKeyMessage = hasExistingKey
        ? 'Enter API Key (leave empty to preserve existing, or if using env vars):'
        : 'Enter API Key (leave empty if using env vars):';

      // Add info about environment variables to the message
      if (provider === 'openai') {
        apiKeyMessage = `${apiKeyMessage} (Env var: OPENAI_API_KEY)`;
      } else if (provider === 'anthropic') {
        apiKeyMessage = `${apiKeyMessage} (Env var: ANTHROPIC_API_KEY)`;
      } else if (provider === 'gemini') {
        apiKeyMessage = `${apiKeyMessage} (Env var: GOOGLE_API_KEY)`;
      } else if (provider === 'openrouter') {
        apiKeyMessage = `${apiKeyMessage} (Env var: OPENROUTER_API_KEY)`;
      }

      if (provider !== 'ollama' && provider !== 'openrouter') {
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

      // Base URL Configuration for OpenRouter
      if (provider === 'openrouter') {
        const baseUrl = await input({
          message: 'Enter OpenRouter Base URL:',
          default: currentConfig.llm.base_url || 'https://openrouter.ai/api/v1',
        });
        await configManager.set('llm.base_url', baseUrl);
      }

      // Context Window Configuration
      const contextWindow = await input({
        message: 'Context Window Size (number of messages to send to LLM):',
        default: currentConfig.llm.context_window?.toString() || '100',
        validate: (val) => (!isNaN(Number(val)) && Number(val) > 0) || 'Must be a positive number'
      });

      await configManager.set('llm.context_window', Number(contextWindow));

      // Sati (Memory Agent) Configuration
      display.log(chalk.blue('\nSati (Memory Agent) Configuration'));
      const configureSati = await select({
          message: 'Configure Sati separately?',
          choices: [
              { name: 'No (Use main LLM settings)', value: 'no' },
              { name: 'Yes', value: 'yes' },
          ],
          default: 'no',
      });

      let satiProvider = provider;
      let satiModel = model;
      let satiApiKey = apiKey;
      
      // If using main settings and no new key provided, use existing if available
      if (configureSati === 'no' && !satiApiKey && hasExistingKey) {
          satiApiKey = currentConfig.llm.api_key;
      }

      if (configureSati === 'yes') {
        satiProvider = await select({
            message: 'Select Sati LLM Provider:',
            choices: [
              { name: 'OpenAI', value: 'openai' },
              { name: 'Anthropic', value: 'anthropic' },
              { name: 'OpenRouter', value: 'openrouter' },
              { name: 'Ollama', value: 'ollama' },
              { name: 'Google Gemini', value: 'gemini' },
            ],
            default: currentConfig.sati?.provider || provider,
        });

        let defaultSatiModel = 'gpt-3.5-turbo';
        switch(satiProvider) {
            case 'openai': defaultSatiModel = 'gpt-4o'; break;
            case 'anthropic': defaultSatiModel = 'claude-3-5-sonnet-20240620'; break;
            case 'openrouter': defaultSatiModel = 'openrouter/auto'; break;
            case 'ollama': defaultSatiModel = 'llama3'; break;
            case 'gemini': defaultSatiModel = 'gemini-pro'; break;
        }

        if (satiProvider === currentConfig.sati?.provider) {
             defaultSatiModel = currentConfig.sati?.model || defaultSatiModel;
        }

        satiModel = await input({
            message: 'Enter Sati Model Name:',
            default: defaultSatiModel,
        });

        const hasExistingSatiKey = !!currentConfig.sati?.api_key;
        let satiKeyMsg = hasExistingSatiKey
          ? 'Enter Sati API Key (leave empty to preserve existing, or if using env vars):'
          : 'Enter Sati API Key (leave empty if using env vars):';

        // Add info about environment variables to the message
        if (satiProvider === 'openai') {
          satiKeyMsg = `${satiKeyMsg} (Env var: OPENAI_API_KEY)`;
        } else if (satiProvider === 'anthropic') {
          satiKeyMsg = `${satiKeyMsg} (Env var: ANTHROPIC_API_KEY)`;
        } else if (satiProvider === 'gemini') {
          satiKeyMsg = `${satiKeyMsg} (Env var: GOOGLE_API_KEY)`;
        } else if (satiProvider === 'openrouter') {
          satiKeyMsg = `${satiKeyMsg} (Env var: OPENROUTER_API_KEY)`;
        }

        const keyInput = await password({ message: satiKeyMsg });
        if (keyInput) {
            satiApiKey = keyInput;
        } else if (hasExistingSatiKey) {
            satiApiKey = currentConfig.sati?.api_key;
        } else {
             satiApiKey = undefined; // Ensure we don't accidentally carry over invalid state
        }
        
        // Base URL Configuration for Sati OpenRouter
        if (satiProvider === 'openrouter') {
            const satiBaseUrl = await input({
                message: 'Enter Sati OpenRouter Base URL:',
                default: currentConfig.sati?.base_url || 'https://openrouter.ai/api/v1',
            });
            await configManager.set('sati.base_url', satiBaseUrl);
        }
      }

      const memoryLimit = await input({
          message: 'Sati Memory Retrieval Limit (messages):',
          default: currentConfig.sati?.memory_limit?.toString() || '1000',
          validate: (val) => !isNaN(Number(val)) && Number(val) > 0 || 'Must be a positive number'
      });

      await configManager.set('sati.provider', satiProvider);
      await configManager.set('sati.model', satiModel);
      await configManager.set('sati.memory_limit', Number(memoryLimit));
      if (satiApiKey) {
        await configManager.set('sati.api_key', satiApiKey);
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
              let audioKeyMessage = hasExistingAudioKey
                ? 'Enter Gemini API Key for Audio (leave empty to preserve existing, or if using env vars):'
                : 'Enter Gemini API Key for Audio (leave empty if using env vars):';
              
              // Add info about environment variables to the message
              audioKeyMessage = `${audioKeyMessage} (Env var: GOOGLE_API_KEY)`;

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
          let telegramTokenMessage = hasExistingToken
            ? 'Enter Telegram Bot Token (leave empty to preserve existing, or if using env vars):'
            : 'Enter Telegram Bot Token (leave empty if using env vars):';
            
          // Add info about environment variables to the message
          telegramTokenMessage = `${telegramTokenMessage} (Env var: TELEGRAM_BOT_TOKEN)`;
          
          const token = await password({
            message: telegramTokenMessage,
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
