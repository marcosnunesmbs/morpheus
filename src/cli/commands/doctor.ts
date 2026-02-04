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
        const satiDbPath = path.join(PATHS.memory, 'santi-memory.db');
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
