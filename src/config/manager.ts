import fs from 'fs-extra';
import yaml from 'js-yaml';
import { z } from 'zod';
import { MorpheusConfig, DEFAULT_CONFIG, SatiConfig, ApocConfig, NeoConfig, TrinityConfig, LLMProvider, ChronosConfig, SubAgentExecutionMode } from '../types/config.js';
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
import { encrypt, safeDecrypt, looksLikeEncrypted, canEncrypt } from '../runtime/trinity-crypto.js';
import { DisplayManager } from '../runtime/display.js';

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

  /**
   * Decrypts API keys in config if they appear to be encrypted.
   * Fail-open: returns original value if decryption fails.
   */
  private decryptAgentApiKeys(config: MorpheusConfig): MorpheusConfig {
    const decrypted = { ...config };

    // Helper to decrypt a single key
    const tryDecrypt = (apiKey: string | undefined): string | undefined => {
      if (!apiKey) return undefined;
      if (!looksLikeEncrypted(apiKey)) return apiKey;
      const decrypted = safeDecrypt(apiKey);
      return decrypted ?? apiKey; // Return original if decryption fails
    };

    // Decrypt Oracle/LLM
    if (decrypted.llm.api_key) {
      decrypted.llm = { ...decrypted.llm, api_key: tryDecrypt(decrypted.llm.api_key) };
    }

    // Decrypt Sati
    if (decrypted.sati?.api_key) {
      decrypted.sati = { ...decrypted.sati, api_key: tryDecrypt(decrypted.sati.api_key) };
    }

    // Decrypt Apoc
    if (decrypted.apoc?.api_key) {
      decrypted.apoc = { ...decrypted.apoc, api_key: tryDecrypt(decrypted.apoc.api_key) };
    }

    // Decrypt Neo
    if (decrypted.neo?.api_key) {
      decrypted.neo = { ...decrypted.neo, api_key: tryDecrypt(decrypted.neo.api_key) };
    }

    // Decrypt Trinity
    if (decrypted.trinity?.api_key) {
      decrypted.trinity = { ...decrypted.trinity, api_key: tryDecrypt(decrypted.trinity.api_key) };
    }

    // Decrypt Audio (Telephonist)
    if (decrypted.audio?.apiKey) {
      decrypted.audio = { ...decrypted.audio, apiKey: tryDecrypt(decrypted.audio.apiKey) };
    }

    return decrypted;
  }

  /**
   * Encrypts API keys in config if MORPHEUS_SECRET is set.
   */
  private encryptAgentApiKeys(config: MorpheusConfig): MorpheusConfig {
    if (!canEncrypt()) return config;

    const encrypted = { ...config };

    // Helper to encrypt a single key
    const tryEncrypt = (apiKey: string | undefined): string | undefined => {
      if (!apiKey) return undefined;
      // Don't double-encrypt
      if (looksLikeEncrypted(apiKey)) return apiKey;
      return encrypt(apiKey);
    };

    // Encrypt Oracle/LLM
    if (encrypted.llm.api_key) {
      encrypted.llm = { ...encrypted.llm, api_key: tryEncrypt(encrypted.llm.api_key) };
    }

    // Encrypt Sati
    if (encrypted.sati?.api_key) {
      encrypted.sati = { ...encrypted.sati, api_key: tryEncrypt(encrypted.sati.api_key) };
    }

    // Encrypt Apoc
    if (encrypted.apoc?.api_key) {
      encrypted.apoc = { ...encrypted.apoc, api_key: tryEncrypt(encrypted.apoc.api_key) };
    }

    // Encrypt Neo
    if (encrypted.neo?.api_key) {
      encrypted.neo = { ...encrypted.neo, api_key: tryEncrypt(encrypted.neo.api_key) };
    }

    // Encrypt Trinity
    if (encrypted.trinity?.api_key) {
      encrypted.trinity = { ...encrypted.trinity, api_key: tryEncrypt(encrypted.trinity.api_key) };
    }

    // Encrypt Audio (Telephonist)
    if (encrypted.audio?.apiKey) {
      encrypted.audio = { ...encrypted.audio, apiKey: tryEncrypt(encrypted.audio.apiKey) };
    }

    return encrypted;
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

    // Apply precedence to Apoc config
    let apocConfig: ApocConfig | undefined;
    if (config.apoc) {
      const apocProvider = resolveProvider('MORPHEUS_APOC_PROVIDER', config.apoc.provider, llmConfig.provider);
      apocConfig = {
        provider: apocProvider,
        model: resolveModel(apocProvider, 'MORPHEUS_APOC_MODEL', config.apoc.model || llmConfig.model),
        temperature: resolveNumeric('MORPHEUS_APOC_TEMPERATURE', config.apoc.temperature, llmConfig.temperature),
        max_tokens: config.apoc.max_tokens !== undefined ? resolveNumeric('MORPHEUS_APOC_MAX_TOKENS', config.apoc.max_tokens, config.apoc.max_tokens!) : llmConfig.max_tokens,
        api_key: resolveApiKey(apocProvider, 'MORPHEUS_APOC_API_KEY', config.apoc.api_key || llmConfig.api_key),
        base_url: config.apoc.base_url || config.llm.base_url,
        context_window: config.apoc.context_window !== undefined ? resolveNumeric('MORPHEUS_APOC_CONTEXT_WINDOW', config.apoc.context_window, config.apoc.context_window!) : llmConfig.context_window,
        working_dir: resolveString('MORPHEUS_APOC_WORKING_DIR', config.apoc.working_dir, process.cwd()),
        timeout_ms: config.apoc.timeout_ms !== undefined ? resolveNumeric('MORPHEUS_APOC_TIMEOUT_MS', config.apoc.timeout_ms, 30_000) : 30_000,
        personality: resolveString('MORPHEUS_APOC_PERSONALITY', config.apoc.personality, 'pragmatic_dev'),
        execution_mode: resolveString('MORPHEUS_APOC_EXECUTION_MODE', config.apoc.execution_mode, 'async') as SubAgentExecutionMode,
      };
    }

    // Apply precedence to Neo config
    const neoEnvVars = [
      'MORPHEUS_NEO_PROVIDER',
      'MORPHEUS_NEO_MODEL',
      'MORPHEUS_NEO_TEMPERATURE',
      'MORPHEUS_NEO_MAX_TOKENS',
      'MORPHEUS_NEO_API_KEY',
      'MORPHEUS_NEO_BASE_URL',
      'MORPHEUS_NEO_CONTEXT_WINDOW',
    ];
    const hasNeoEnvOverrides = neoEnvVars.some((envVar) => process.env[envVar] !== undefined);

    const resolveOptionalNumeric = (
      envVar: string,
      configValue: number | undefined,
      fallbackValue: number | undefined
    ): number | undefined => {
      if (fallbackValue !== undefined) {
        return resolveNumeric(envVar, configValue, fallbackValue);
      }

      if (process.env[envVar] !== undefined && process.env[envVar] !== '') {
        const parsed = Number(process.env[envVar]);
        if (!Number.isNaN(parsed)) {
          return parsed;
        }
      }

      return configValue;
    };

    let neoConfig: NeoConfig | undefined;
    if (config.neo || hasNeoEnvOverrides) {
      const neoProvider = resolveProvider('MORPHEUS_NEO_PROVIDER', config.neo?.provider, llmConfig.provider);
      const neoBaseUrl = resolveString('MORPHEUS_NEO_BASE_URL', config.neo?.base_url, llmConfig.base_url || '');
      const neoMaxTokensFallback = config.neo?.max_tokens ?? llmConfig.max_tokens;
      const neoContextWindowFallback = config.neo?.context_window ?? llmConfig.context_window;

      neoConfig = {
        provider: neoProvider,
        model: resolveModel(neoProvider, 'MORPHEUS_NEO_MODEL', config.neo?.model || llmConfig.model),
        temperature: resolveNumeric('MORPHEUS_NEO_TEMPERATURE', config.neo?.temperature, llmConfig.temperature),
        max_tokens: resolveOptionalNumeric('MORPHEUS_NEO_MAX_TOKENS', config.neo?.max_tokens, neoMaxTokensFallback),
        api_key: resolveApiKey(neoProvider, 'MORPHEUS_NEO_API_KEY', config.neo?.api_key || llmConfig.api_key),
        base_url: neoBaseUrl || undefined,
        context_window: resolveOptionalNumeric('MORPHEUS_NEO_CONTEXT_WINDOW', config.neo?.context_window, neoContextWindowFallback),
        personality: resolveString('MORPHEUS_NEO_PERSONALITY', config.neo?.personality, 'analytical_engineer'),
        execution_mode: resolveString('MORPHEUS_NEO_EXECUTION_MODE', config.neo?.execution_mode, 'async') as SubAgentExecutionMode,
      };
    }

    // Apply precedence to Trinity config
    const trinityEnvVars = [
      'MORPHEUS_TRINITY_PROVIDER',
      'MORPHEUS_TRINITY_MODEL',
      'MORPHEUS_TRINITY_TEMPERATURE',
      'MORPHEUS_TRINITY_API_KEY',
    ];
    const hasTrinityEnvOverrides = trinityEnvVars.some((envVar) => process.env[envVar] !== undefined);

    let trinityConfig: TrinityConfig | undefined;
    if (config.trinity || hasTrinityEnvOverrides) {
      const trinityProvider = resolveProvider('MORPHEUS_TRINITY_PROVIDER', config.trinity?.provider, llmConfig.provider);
      const trinityMaxTokensFallback = config.trinity?.max_tokens ?? llmConfig.max_tokens;
      const trinityContextWindowFallback = config.trinity?.context_window ?? llmConfig.context_window;

      trinityConfig = {
        provider: trinityProvider,
        model: resolveModel(trinityProvider, 'MORPHEUS_TRINITY_MODEL', config.trinity?.model || llmConfig.model),
        temperature: resolveNumeric('MORPHEUS_TRINITY_TEMPERATURE', config.trinity?.temperature, llmConfig.temperature),
        max_tokens: resolveOptionalNumeric('MORPHEUS_TRINITY_MAX_TOKENS', config.trinity?.max_tokens, trinityMaxTokensFallback),
        api_key: resolveApiKey(trinityProvider, 'MORPHEUS_TRINITY_API_KEY', config.trinity?.api_key || llmConfig.api_key),
        base_url: config.trinity?.base_url || config.llm.base_url,
        context_window: resolveOptionalNumeric('MORPHEUS_TRINITY_CONTEXT_WINDOW', config.trinity?.context_window, trinityContextWindowFallback),
        personality: resolveString('MORPHEUS_TRINITY_PERSONALITY', config.trinity?.personality, 'data_specialist'),
        execution_mode: resolveString('MORPHEUS_TRINITY_EXECUTION_MODE', config.trinity?.execution_mode, 'async') as SubAgentExecutionMode,
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
        enabled: config.channels.discord.enabled,
        token: config.channels.discord.token,
        allowedUsers: config.channels.discord.allowedUsers ?? []
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

    // Apply precedence to Chronos config
    let chronosConfig: ChronosConfig | undefined;
    if (config.chronos) {
      chronosConfig = {
        timezone: resolveString('MORPHEUS_CHRONOS_TIMEZONE', config.chronos.timezone, 'UTC'),
        check_interval_ms: resolveNumeric('MORPHEUS_CHRONOS_CHECK_INTERVAL_MS', config.chronos.check_interval_ms, 60000),
        max_active_jobs: resolveNumeric('MORPHEUS_CHRONOS_MAX_ACTIVE_JOBS', config.chronos.max_active_jobs, 100),
      };
    }

    return {
      agent: agentConfig,
      llm: llmConfig,
      sati: satiConfig,
      neo: neoConfig,
      apoc: apocConfig,
      trinity: trinityConfig,
      audio: audioConfig,
      channels: channelsConfig,
      ui: uiConfig,
      logging: loggingConfig,
      memory: memoryConfig,
      chronos: chronosConfig,
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
    let updated = { ...this.config, ...newConfig };
    
    // Encrypt API keys before saving if MORPHEUS_SECRET is set
    updated = this.encryptAgentApiKeys(updated);
    
    // Validate before saving
    const valid = ConfigSchema.parse(updated);

    // Warn if saving without encryption
    if (!canEncrypt()) {
      const display = DisplayManager.getInstance();
      display.log(
        'API keys saved in PLAINTEXT. Set MORPHEUS_SECRET environment variable to enable AES-256-GCM encryption.',
        { source: 'ConfigManager', level: 'warning' }
      );
    }

    await fs.ensureDir(PATHS.root);
    await fs.writeFile(PATHS.config, yaml.dump(valid), 'utf8');
    this.config = valid as MorpheusConfig;
  }

  public getLLMConfig() {
    return this.config.llm;
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

  public getApocConfig(): ApocConfig {
    if (this.config.apoc) {
      return {
        working_dir: process.cwd(),
        timeout_ms: 30_000,
        ...this.config.apoc
      };
    }

    // Fallback to main LLM config with Apoc defaults
    return {
      ...this.config.llm,
      working_dir: process.cwd(),
      timeout_ms: 30_000
    };
  }

  public getNeoConfig(): NeoConfig {
    if (this.config.neo) {
      return {
        ...this.config.neo
      };
    }

    // Fallback to main LLM config
    return {
      ...this.config.llm,
    };
  }

  public getTrinityConfig(): TrinityConfig {
    if (this.config.trinity) {
      return { ...this.config.trinity };
    }

    // Fallback to main LLM config
    return { ...this.config.llm };
  }

  public getChronosConfig(): ChronosConfig {
    const defaults: ChronosConfig = { timezone: 'UTC', check_interval_ms: 60000, max_active_jobs: 100 };
    if (this.config.chronos) {
      return { ...defaults, ...this.config.chronos };
    }
    return defaults;
  }

  /**
   * Returns encryption status for all agent API keys.
   */
  public getEncryptionStatus(): {
    morpheusSecretSet: boolean;
    apiKeysEncrypted: {
      oracle: boolean;
      sati: boolean;
      neo: boolean;
      apoc: boolean;
      trinity: boolean;
      audio: boolean;
    };
    hasPlaintextKeys: boolean;
  } {
    const checkKey = (apiKey: string | undefined): boolean => {
      if (!apiKey) return true; // No key = not plaintext
      return looksLikeEncrypted(apiKey);
    };

    const apiKeysEncrypted = {
      oracle: checkKey(this.config.llm.api_key),
      sati: checkKey(this.config.sati?.api_key),
      neo: checkKey(this.config.neo?.api_key),
      apoc: checkKey(this.config.apoc?.api_key),
      trinity: checkKey(this.config.trinity?.api_key),
      audio: checkKey(this.config.audio?.apiKey),
    };

    const hasPlaintextKeys = Object.values(apiKeysEncrypted).some(encrypted => !encrypted);

    return {
      morpheusSecretSet: canEncrypt(),
      apiKeysEncrypted,
      hasPlaintextKeys,
    };
  }
}
