import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { PATHS } from '../../config/paths.js';
import { ConfigManager } from '../../config/manager.js';

export const doctorCommand = new Command('doctor')
  .description('Diagnose environment and configuration issues')
  .action(async () => {
    console.log(chalk.bold('Morpheus Doctor'));
    console.log(chalk.gray('================'));

    let allPassed = true;

    // 1. Check Node.js Version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.replace('v', '').split('.')[0], 10);
    if (majorVersion >= 18) {
      console.log(chalk.green('✓') + ` Node.js Version: ${nodeVersion} (Satisfied)`);
    } else {
      console.log(chalk.red('✗') + ` Node.js Version: ${nodeVersion} (Required: >=18)`);
      allPassed = false;
    }

    // 2. Check Configuration
    try {
      if (await fs.pathExists(PATHS.config)) {
        const config = await ConfigManager.getInstance().load();
        console.log(chalk.green('✓') + ' Configuration: Valid');

        // Check context window configuration
        const contextWindow = config.llm?.context_window;
        const deprecatedLimit = config.memory?.limit;

        if (contextWindow !== undefined) {
          if (typeof contextWindow === 'number' && contextWindow > 0) {
            console.log(chalk.green('✓') + ` LLM context window: ${contextWindow} messages`);
          } else {
            console.log(chalk.red('✗') + ` LLM context window has invalid value, using default: 100 messages`);
            allPassed = false;
          }
        } else {
          console.log(chalk.yellow('⚠') + ' LLM context window not configured, using default: 100 messages');
        }

        // Check for deprecated field
        if (deprecatedLimit !== undefined && contextWindow === undefined) {
          console.log(chalk.yellow('⚠') + ' Deprecated config detected: \'memory.limit\' should be migrated to \'llm.context_window\'. Will auto-migrate on next start.');
        } else if (deprecatedLimit !== undefined && contextWindow !== undefined) {
          console.log(chalk.yellow('⚠') + ' Found both \'memory.limit\' and \'llm.context_window\'. Remove \'memory.limit\' from config.');
        }

        // Check API keys availability for active providers
        const llmProvider = config.llm?.provider;
        const satiProvider = config.sati?.provider;
        const apocProvider = config.apoc?.provider || llmProvider;
        const neoProvider = config.neo?.provider || llmProvider;
        
        // Check LLM provider API key
        if (llmProvider && llmProvider !== 'ollama') {
          const hasLlmApiKey = config.llm?.api_key || 
                              (llmProvider === 'openai' && process.env.OPENAI_API_KEY) ||
                              (llmProvider === 'anthropic' && process.env.ANTHROPIC_API_KEY) ||
                              (llmProvider === 'gemini' && process.env.GOOGLE_API_KEY) ||
                              (llmProvider === 'openrouter' && process.env.OPENROUTER_API_KEY);
          
          if (hasLlmApiKey) {
            console.log(chalk.green('✓') + ` LLM API key available for ${llmProvider}`);
          } else {
            console.log(chalk.red('✗') + ` LLM API key missing for ${llmProvider}. Either set in config or define environment variable.`);
            allPassed = false;
          }
        }

        // Check Sati provider API key
        if (satiProvider && satiProvider !== 'ollama') {
          const hasSantiApiKey = config.sati?.api_key || 
                                (satiProvider === 'openai' && process.env.OPENAI_API_KEY) ||
                                (satiProvider === 'anthropic' && process.env.ANTHROPIC_API_KEY) ||
                                (satiProvider === 'gemini' && process.env.GOOGLE_API_KEY) ||
                                (satiProvider === 'openrouter' && process.env.OPENROUTER_API_KEY);
          
          if (hasSantiApiKey) {
            console.log(chalk.green('✓') + ` Sati API key available for ${satiProvider}`);
          } else {
            console.log(chalk.red('✗') + ` Sati API key missing for ${satiProvider}. Either set in config or define environment variable.`);
            allPassed = false;
          }
        }

        // Check Apoc provider API key
        if (apocProvider && apocProvider !== 'ollama') {
          const hasApocApiKey = config.apoc?.api_key ||
                                config.llm?.api_key ||
                                (apocProvider === 'openai' && process.env.OPENAI_API_KEY) ||
                                (apocProvider === 'anthropic' && process.env.ANTHROPIC_API_KEY) ||
                                (apocProvider === 'gemini' && process.env.GOOGLE_API_KEY) ||
                                (apocProvider === 'openrouter' && process.env.OPENROUTER_API_KEY);

          if (hasApocApiKey) {
            console.log(chalk.green('✓') + ` Apoc API key available for ${apocProvider}`);
          } else {
            console.log(chalk.red('✗') + ` Apoc API key missing for ${apocProvider}. Either set in config or define environment variable.`);
            allPassed = false;
          }
        }

        // Check Neo provider API key
        if (neoProvider && neoProvider !== 'ollama') {
          const hasNeoApiKey = config.neo?.api_key ||
                               config.llm?.api_key ||
                               (neoProvider === 'openai' && process.env.OPENAI_API_KEY) ||
                               (neoProvider === 'anthropic' && process.env.ANTHROPIC_API_KEY) ||
                               (neoProvider === 'gemini' && process.env.GOOGLE_API_KEY) ||
                               (neoProvider === 'openrouter' && process.env.OPENROUTER_API_KEY);

          if (hasNeoApiKey) {
            console.log(chalk.green('✓') + ` Neo API key available for ${neoProvider}`);
          } else {
            console.log(chalk.red('✗') + ` Neo API key missing for ${neoProvider}. Either set in config or define environment variable.`);
            allPassed = false;
          }
        }

        // Check audio API key if enabled
        if (config.audio?.enabled && config.llm?.provider !== 'gemini') {
          const hasAudioApiKey = config.audio?.apiKey || process.env.GOOGLE_API_KEY;
          if (hasAudioApiKey) {
            console.log(chalk.green('✓') + ' Audio API key available for transcription');
          } else {
            console.log(chalk.red('✗') + ' Audio API key missing. Either set in config or define GOOGLE_API_KEY environment variable.');
            allPassed = false;
          }
        }

        // Check Telegram token if enabled
        if (config.channels?.telegram?.enabled) {
          const hasTelegramToken = config.channels.telegram?.token || process.env.TELEGRAM_BOT_TOKEN;
          if (hasTelegramToken) {
            console.log(chalk.green('✓') + ' Telegram bot token available');
          } else {
            console.log(chalk.red('✗') + ' Telegram bot token missing. Either set in config or define TELEGRAM_BOT_TOKEN environment variable.');
            allPassed = false;
          }
        }

        // Check if default password is being used for dashboard
        if (!process.env.THE_ARCHITECT_PASS) {
          console.log(chalk.yellow('⚠') + ' Using default password for dashboard (iamthearchitect). For security, set THE_ARCHITECT_PASS environment variable.');
        } else {
          console.log(chalk.green('✓') + ' Custom dashboard password set');
        }
      } else {
        console.log(chalk.yellow('!') + ' Configuration: Missing (will be created on start)');
      }
    } catch (error: any) {
      console.log(chalk.red('✗') + ` Configuration: Invalid (${error.message})`);
      allPassed = false;
    }

    // 3. Check Permissions
    try {
      await fs.ensureDir(PATHS.root);
      const testFile = path.join(PATHS.root, '.perm-test');
      await fs.writeFile(testFile, 'test');
      await fs.remove(testFile);
      console.log(chalk.green('✓') + ` Permissions: Write access to ${PATHS.root}`);
    } catch (error: any) {
      console.log(chalk.red('✗') + ` Permissions: Cannot write to ${PATHS.root}`);
      allPassed = false;
    }

    // 4. Check Logs Permissions
    try {
      await fs.ensureDir(PATHS.logs);
      const testLogFile = path.join(PATHS.logs, '.perm-test');
      await fs.writeFile(testLogFile, 'test');
      await fs.remove(testLogFile);
      console.log(chalk.green('✓') + ` Logs: Write access to ${PATHS.logs}`);
    } catch (error: any) {
      console.log(chalk.red('✗') + ` Logs: Cannot write to ${PATHS.logs}`);
      allPassed = false;
    }

    // 5. Check Sati Memory DB
    try {
        const satiDbPath = path.join(PATHS.memory, 'sati-memory.db');
        if (await fs.pathExists(satiDbPath)) {
            console.log(chalk.green('✓') + ' Sati Memory: Database exists');
        } else {
            console.log(chalk.yellow('!') + ' Sati Memory: Database not initialized (will be created on start)');
        }
    } catch (error: any) {
        console.log(chalk.red('✗') + ` Sati Memory: Check failed (${error.message})`);
    }

    console.log(chalk.gray('================'));
    if (allPassed) {
      console.log(chalk.green('Diagnostics Passed. You are ready to run Morpheus!'));
    } else {
      console.log(chalk.red('Issues detected. Please fix them before running Morpheus.'));
      process.exit(1);
    }
  });
