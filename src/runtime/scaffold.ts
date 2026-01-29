import fs from 'fs-extra';
import { PATHS } from '../config/paths.js';
import { ConfigManager } from '../config/manager.js';
import chalk from 'chalk';
import ora from 'ora';

export async function scaffold(): Promise<void> {
  const spinner = ora('Ensuring Morpheus environment...').start();

  try {
    // Create all directories
    await Promise.all([
      fs.ensureDir(PATHS.root),
      fs.ensureDir(PATHS.logs),
      fs.ensureDir(PATHS.memory),
      fs.ensureDir(PATHS.cache),
      fs.ensureDir(PATHS.commands),
    ]);

    // Create config if not exists
    const configManager = ConfigManager.getInstance();
    if (!(await fs.pathExists(PATHS.config))) {
        await configManager.save({}); // Saves default config
    } else {
        await configManager.load(); // Load if exists (although load handles existence check too)
    }

    spinner.succeed('Morpheus environment ready at ' + chalk.cyan(PATHS.root));
  } catch (error) {
    spinner.fail('Failed to scaffold environment');
    throw error;
  }
}
