import { z } from 'zod';
import { ConfigSchema } from '../types/config.js';
import { PATHS } from './paths.js';
import fs from 'fs';
import path from 'path';

class ConfigManager {
  private config: z.infer<typeof ConfigSchema>;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): z.infer<typeof ConfigSchema> {
    const configPath = path.join(PATHS.config, 'config.json');
    if (fs.existsSync(configPath)) {
      const rawConfig = fs.readFileSync(configPath, 'utf-8');
      const parsedConfig = JSON.parse(rawConfig);
      return ConfigSchema.parse(parsedConfig);
    }
    return ConfigSchema.parse({}); // Return default config if no file exists
  }

  public getConfig(): z.infer<typeof ConfigSchema> {
    return this.config;
  }

  public saveConfig(newConfig: z.infer<typeof ConfigSchema>): void {
    this.config = newConfig;
    const configPath = path.join(PATHS.config, 'config.json');
    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
  }
}

export const configManager = new ConfigManager();