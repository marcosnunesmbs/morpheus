import fs from 'fs-extra';
import yaml from 'js-yaml';
import { z } from 'zod';
import { MorpheusConfig, DEFAULT_CONFIG } from '../types/config.js';
import { PATHS } from './paths.js';
import { setByPath } from './utils.js';

// Zod Schema matching MorpheusConfig interface
const ConfigSchema = z.object({
  agent: z.object({
    name: z.string().default(DEFAULT_CONFIG.agent.name),
    personality: z.string().default(DEFAULT_CONFIG.agent.personality),
  }).default(DEFAULT_CONFIG.agent),
  llm: z.object({
    provider: z.enum(['openai', 'anthropic', 'ollama', 'gemini']).default(DEFAULT_CONFIG.llm.provider),
    model: z.string().default(DEFAULT_CONFIG.llm.model),
    temperature: z.number().min(0).max(1).default(DEFAULT_CONFIG.llm.temperature),
    api_key: z.string().optional(),
  }).default(DEFAULT_CONFIG.llm),
  channels: z.object({
    telegram: z.object({
      enabled: z.boolean().default(false),
      token: z.string().optional(),
    }).default(DEFAULT_CONFIG.channels.telegram),
    discord: z.object({
      enabled: z.boolean().default(false),
      token: z.string().optional(),
    }).default(DEFAULT_CONFIG.channels.discord),
  }).default(DEFAULT_CONFIG.channels),
  ui: z.object({
    enabled: z.boolean().default(DEFAULT_CONFIG.ui.enabled),
    port: z.number().default(DEFAULT_CONFIG.ui.port),
  }).default(DEFAULT_CONFIG.ui),
});

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
