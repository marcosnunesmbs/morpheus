import fs from 'fs-extra';
import yaml from 'js-yaml';
import { z } from 'zod';
import { MorpheusConfig, DEFAULT_CONFIG, SatiConfig, LLMProvider, SubAgentConfig } from '../types/config.js';
import type { AgentName } from '../agents/types.js';
import { PATHS } from './paths.js';
import { setByPath } from './utils.js';
import { ConfigSchema } from './schemas.js';
import { migrateConfigFile } from '../runtime/migration.js';
import { 
  resolveApiKey, 
  resolveModel, 
  resolveNumeric, 
  resolveString, 
  resolveBoolean, 
  resolveProvider,
  resolveStringArray
} from './precedence.js';

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

      let rawConfig: MorpheusConfig = DEFAULT_CONFIG;

      if (await fs.pathExists(PATHS.config)) {
        const raw = await fs.readFile(PATHS.config, 'utf8');
        const parsed = yaml.load(raw);
        // Validate and merge with defaults via Zod
        rawConfig = ConfigSchema.parse(parsed) as MorpheusConfig;
      }

      // Apply environment variable precedence to the loaded config
      this.config = this.applyEnvironmentVariablePrecedence(rawConfig);
    } catch (error) {
      console.error('Failed to load configuration:', error);
      // Fallback to default if load fails
      this.config = DEFAULT_CONFIG;
    }
    return this.config;
  }

  private applyEnvironmentVariablePrecedence(config: MorpheusConfig): MorpheusConfig {
    // Apply precedence to agent config
    const agentConfig = {
      name: resolveString('MORPHEUS_AGENT_NAME', config.agent.name, DEFAULT_CONFIG.agent.name),
      personality: resolveString('MORPHEUS_AGENT_PERSONALITY', config.agent.personality, DEFAULT_CONFIG.agent.personality)
    };

    // Apply precedence to LLM config
    const llmProvider = resolveProvider('MORPHEUS_LLM_PROVIDER', config.llm.provider, DEFAULT_CONFIG.llm.provider);
    const llmConfig = {
      provider: llmProvider,
      model: resolveModel(llmProvider, 'MORPHEUS_LLM_MODEL', config.llm.model),
      temperature: resolveNumeric('MORPHEUS_LLM_TEMPERATURE', config.llm.temperature, DEFAULT_CONFIG.llm.temperature),
      max_tokens: config.llm.max_tokens !== undefined ? resolveNumeric('MORPHEUS_LLM_MAX_TOKENS', config.llm.max_tokens, config.llm.max_tokens!) : undefined,
      api_key: resolveApiKey(llmProvider, 'MORPHEUS_LLM_API_KEY', config.llm.api_key),
      base_url: config.llm.base_url, // base_url doesn't have environment variable precedence for now
      context_window: config.llm.context_window !== undefined ? resolveNumeric('MORPHEUS_LLM_CONTEXT_WINDOW', config.llm.context_window, DEFAULT_CONFIG.llm.context_window!) : undefined
    };

    // Apply precedence to Sati config
    let satiConfig: SatiConfig | undefined;
    if (config.sati) {
      const satiProvider = resolveProvider('MORPHEUS_SATI_PROVIDER', config.sati.provider, llmConfig.provider);
      satiConfig = {
        provider: satiProvider,
        model: resolveModel(satiProvider, 'MORPHEUS_SATI_MODEL', config.sati.model || llmConfig.model),
        temperature: resolveNumeric('MORPHEUS_SATI_TEMPERATURE', config.sati.temperature, llmConfig.temperature),
        max_tokens: config.sati.max_tokens !== undefined ? resolveNumeric('MORPHEUS_SATI_MAX_TOKENS', config.sati.max_tokens, config.sati.max_tokens!) : llmConfig.max_tokens,
        api_key: resolveApiKey(satiProvider, 'MORPHEUS_SATI_API_KEY', config.sati.api_key || llmConfig.api_key),
        base_url: config.sati.base_url || config.llm.base_url,
        context_window: config.sati.context_window !== undefined ? resolveNumeric('MORPHEUS_SATI_CONTEXT_WINDOW', config.sati.context_window, config.sati.context_window!) : llmConfig.context_window,
        memory_limit: config.sati.memory_limit !== undefined ? resolveNumeric('MORPHEUS_SATI_MEMORY_LIMIT', config.sati.memory_limit, config.sati.memory_limit!) : undefined,
        enabled_archived_sessions: resolveBoolean('MORPHEUS_SATI_ENABLED_ARCHIVED_SESSIONS', config.sati.enabled_archived_sessions, true)
      };
    }

    // Apply precedence to audio config
    const audioProvider = resolveString('MORPHEUS_AUDIO_PROVIDER', config.audio.provider, DEFAULT_CONFIG.audio.provider) as typeof config.audio.provider;
    // AudioProvider uses 'google' but resolveApiKey expects LLMProvider which uses 'gemini'
    const audioProviderForKey = (audioProvider === 'google' ? 'gemini' : audioProvider) as LLMProvider;
    const audioConfig = {
      provider: audioProvider,
      model: resolveString('MORPHEUS_AUDIO_MODEL', config.audio.model, DEFAULT_CONFIG.audio.model),
      enabled: resolveBoolean('MORPHEUS_AUDIO_ENABLED', config.audio.enabled, DEFAULT_CONFIG.audio.enabled),
      apiKey: resolveApiKey(audioProviderForKey, 'MORPHEUS_AUDIO_API_KEY', config.audio.apiKey),
      maxDurationSeconds: resolveNumeric('MORPHEUS_AUDIO_MAX_DURATION', config.audio.maxDurationSeconds, DEFAULT_CONFIG.audio.maxDurationSeconds),
      supportedMimeTypes: config.audio.supportedMimeTypes
    };

    // Apply precedence to channel configs
    const channelsConfig = {
      telegram: {
        enabled: resolveBoolean('MORPHEUS_TELEGRAM_ENABLED', config.channels.telegram.enabled, DEFAULT_CONFIG.channels.telegram.enabled),
        token: resolveString('MORPHEUS_TELEGRAM_TOKEN', config.channels.telegram.token, config.channels.telegram.token || ''),
        allowedUsers: resolveStringArray('MORPHEUS_TELEGRAM_ALLOWED_USERS', config.channels.telegram.allowedUsers, DEFAULT_CONFIG.channels.telegram.allowedUsers)
      },
      discord: {
        enabled: config.channels.discord.enabled, // Discord doesn't have env var precedence for now
        token: config.channels.discord.token
      }
    };

    // Apply precedence to UI config
    const uiConfig = {
      enabled: resolveBoolean('MORPHEUS_UI_ENABLED', config.ui.enabled, DEFAULT_CONFIG.ui.enabled),
      port: resolveNumeric('MORPHEUS_UI_PORT', config.ui.port, DEFAULT_CONFIG.ui.port)
    };

    // Apply precedence to logging config
    const loggingConfig = {
      enabled: resolveBoolean('MORPHEUS_LOGGING_ENABLED', config.logging.enabled, DEFAULT_CONFIG.logging.enabled),
      level: resolveString('MORPHEUS_LOGGING_LEVEL', config.logging.level, DEFAULT_CONFIG.logging.level) as 'debug' | 'info' | 'warn' | 'error',
      retention: resolveString('MORPHEUS_LOGGING_RETENTION', config.logging.retention, DEFAULT_CONFIG.logging.retention)
    };

    // Memory config (deprecated, but keeping for backward compatibility)
    const memoryConfig = {
      limit: config.memory.limit // Not applying env var precedence to deprecated field
    };

    return {
      agent: agentConfig,
      llm: llmConfig,
      sati: satiConfig,
      agents: config.agents,
      audio: audioConfig,
      channels: channelsConfig,
      ui: uiConfig,
      logging: loggingConfig,
      memory: memoryConfig
    };
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

  public getLLMConfig() {
    return this.config.llm;
  }

  /**
   * Returns the config for a named subagent, falling back to the main LLM config.
   */
  public getAgentConfig(name: AgentName): SubAgentConfig {
    const agentSpecific = this.config.agents?.[name];
    return {
      ...this.config.llm,
      ...agentSpecific,
    };
  }

  public getAgentsConfig() {
    return this.config.agents ?? {};
  }

  public getSatiConfig(): SatiConfig {
    if (this.config.sati) {
      return {
        memory_limit: 10, // Default if undefined
        ...this.config.sati
      };
    }
    
    // Fallback to main LLM config
    return {
      ...this.config.llm,
      memory_limit: 10 // Default fallback
    };
  }
}
