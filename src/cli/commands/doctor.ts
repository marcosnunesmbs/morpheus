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
        await ConfigManager.getInstance().load();
        console.log(chalk.green('✓') + ' Configuration: Valid');
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
