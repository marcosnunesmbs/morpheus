import fs from 'fs-extra';
import path from 'path';
import yaml from 'js-yaml';
import { PATHS } from '../config/paths.js';
import { DisplayManager } from './display.js';

export async function migrateConfigFile(): Promise<void> {
  const display = DisplayManager.getInstance();
  const legacyPath = (PATHS as any).legacyConfig ?? path.join(PATHS.root, 'config.yaml');
  const newPath = PATHS.config;

  const legacyExists = await fs.pathExists(legacyPath);
  const newExists = await fs.pathExists(newPath);

  if (legacyExists && !newExists) {
    try {
      await fs.ensureDir(PATHS.root);
      await fs.move(legacyPath, newPath, { overwrite: false });
      display.log('Migrated config.yaml to zaion.yaml', { source: 'Zaion', level: 'info' });
    } catch (err: any) {
      display.log(`Failed to migrate config.yaml to zaion.yaml: ${err.message}`, { source: 'Zaion', level: 'warning' });
    }
  }

  if (legacyExists && newExists) {
    display.log('Both config.yaml and zaion.yaml exist. Using zaion.yaml and leaving config.yaml in place.', {
      source: 'Zaion',
      level: 'warning'
    });
  }

  // Migrate memory.limit to llm.context_window
  await migrateContextWindow();
}

/**
 * Migrates memory.limit to llm.context_window
 * Creates backup before modifying config
 */
async function migrateContextWindow(): Promise<void> {
  const display = DisplayManager.getInstance();
  const configPath = PATHS.config;

  try {
    // Check if config file exists
    if (!await fs.pathExists(configPath)) {
      return; // No config to migrate
    }

    // Read current config
    const configContent = await fs.readFile(configPath, 'utf8');
    const config: any = yaml.load(configContent);

    // Check if migration is needed
    const hasOldField = config?.memory?.limit !== undefined;
    const hasNewField = config?.llm?.context_window !== undefined;

    // Already migrated or nothing to migrate
    if (!hasOldField || hasNewField) {
      return;
    }

    // Create backup before migration
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${configPath}.backup-${timestamp}`;
    await fs.copy(configPath, backupPath);
    display.log(`Created config backup: ${backupPath}`, { source: 'Migration', level: 'info' });

    // Perform migration
    if (!config.llm) {
      config.llm = {};
    }
    config.llm.context_window = config.memory.limit;
    delete config.memory.limit;

    // If memory object is now empty, keep it but with undefined limit for backward compat
    if (Object.keys(config.memory || {}).length === 0) {
      config.memory = {};
    }

    // Write migrated config
    const migratedYaml = yaml.dump(config);
    await fs.writeFile(configPath, migratedYaml, 'utf8');

    display.log('Migrated memory.limit → llm.context_window', { source: 'Migration', level: 'info' });
  } catch (error: any) {
    // Fail open: log error but don't crash
    display.log(`Config migration failed: ${error.message}. System will use defaults.`, { 
      source: 'Migration', 
      level: 'warning' 
    });
  }
}
