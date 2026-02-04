import fs from 'fs-extra';
import yaml from 'js-yaml';
import { z } from 'zod';
import { MorpheusConfig, DEFAULT_CONFIG } from '../types/config.js';
import { PATHS } from './paths.js';
import { setByPath } from './utils.js';
import { ConfigSchema } from './schemas.js';
import { migrateConfigFile } from '../runtime/migration.js';

export class ConfigManager {
  private static instance: ConfigManager;
  private config: MorpheusConfig = DEFAULT_CONFIG;

  private constructor() {}

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  public async load(): Promise<MorpheusConfig> {
    try {
      await migrateConfigFile();

      if (await fs.pathExists(PATHS.config)) {
        const raw = await fs.readFile(PATHS.config, 'utf8');
        const parsed = yaml.load(raw);
        // Validate and merge with defaults via Zod
        this.config = ConfigSchema.parse(parsed) as MorpheusConfig;
      } else {
        // File doesn't exist, use defaults
        this.config = DEFAULT_CONFIG;
      }
    } catch (error) {
      console.error('Failed to load configuration:', error);
      // Fallback to default if load fails
      this.config = DEFAULT_CONFIG;
    }
    return this.config;
  }

  public get(): MorpheusConfig {
    return this.config;
  }

  public async set(path: string, value: any): Promise<void> {
    // Clone current config to apply changes
    const configClone = JSON.parse(JSON.stringify(this.config));
    setByPath(configClone, path, value);
    await this.save(configClone);
  }

  public async save(newConfig: Partial<MorpheusConfig>): Promise<void> {
    // Deep merge or overwrite? simpler to overwrite for now or merge top level
    const updated = { ...this.config, ...newConfig };
    // Validate before saving
    const valid = ConfigSchema.parse(updated);
    
    await fs.ensureDir(PATHS.root);
    await fs.writeFile(PATHS.config, yaml.dump(valid), 'utf8');
    this.config = valid as MorpheusConfig;
  }
}
