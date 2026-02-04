import fs from 'fs-extra';
import path from 'path';
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
    return;
  }

  if (legacyExists && newExists) {
    display.log('Both config.yaml and zaion.yaml exist. Using zaion.yaml and leaving config.yaml in place.', {
      source: 'Zaion',
      level: 'warning'
    });
  }
}
