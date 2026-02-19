export interface AgentConfig {
  name: string;
  personality: string;
}

export type LLMProvider = 'openai' | 'anthropic' | 'openrouter' | 'ollama' | 'gemini';

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  temperature: number;
  max_tokens?: number;
  api_key?: string;
  base_url?: string;
  context_window?: number;
}

export interface TelegramConfig {
  enabled: boolean;
  token?: string;
  allowedUsers: string[];
}

export interface ChannelConfig {
  enabled: boolean;
  token?: string;
}

export interface ChannelsConfig {
  telegram: TelegramConfig;
  discord: ChannelConfig;
}

export interface UIConfig {
  enabled: boolean;
  port: number;
}

export interface LogConfig {
  enabled: boolean;
  level: 'debug' | 'info' | 'warn' | 'error';
  retention: string;
}

export type AudioProvider = 'google' | 'openai' | 'openrouter' | 'ollama';

export interface AudioConfig {
  provider: AudioProvider;
  model: string;
  enabled: boolean;
  apiKey?: string;
  base_url?: string;
  maxDurationSeconds: number;
  supportedMimeTypes: string[];
}

export interface SatiConfig extends LLMConfig {
  memory_limit?: number;
  enabled_archived_sessions?: boolean;
}

export interface ApocConfig extends LLMConfig {
  working_dir?: string;
  timeout_ms?: number;
}

export interface WebhookConfig {
  /** If true, all webhook notifications are also sent to Telegram by default */
  telegram_notify_all?: boolean;
}

export interface MemoryConfig {
  /**
   * @deprecated Use llm.context_window instead. This field is kept for backward compatibility.
   */
  limit: number;
}

export interface RuntimeAsyncTasksConfig {
  enabled: boolean;
}

export interface RuntimeConfig {
  async_tasks: RuntimeAsyncTasksConfig;
}

export interface MorpheusConfig {
  agent: AgentConfig;
  llm: LLMConfig;
  sati?: SatiConfig;
  apoc?: ApocConfig;
  webhooks?: WebhookConfig;
  channels: ChannelsConfig;
  ui: UIConfig;
  logging: LogConfig;
  audio: AudioConfig;
  memory: MemoryConfig;
  runtime?: RuntimeConfig;
}

export const DEFAULT_CONFIG: MorpheusConfig = {
  agent: {
    name: 'morpheus',
    personality: 'helpful_dev',
  },
  logging: {
    enabled: true,
    level: 'info',
    retention: '14d',
  },
  audio: {
    provider: 'google',
    model: 'gemini-2.5-flash-lite',
    enabled: true,
    maxDurationSeconds: 300,
    supportedMimeTypes: ['audio/ogg', 'audio/mp3', 'audio/mpeg', 'audio/wav'],
  },
  memory: {
    limit: 100
  },
  runtime: {
    async_tasks: {
      enabled: true,
    },
  },
  llm: {
    provider: 'openai',
    model: 'gpt-4',
    temperature: 0.7,
    context_window: 100,
  },
  channels: {
    telegram: { enabled: false, allowedUsers: [] },
    discord: { enabled: false },
  },
  ui: {
    enabled: true,
    port: 3333,
  },
  sati: {
    provider: 'openai',
    model: 'gpt-4',
    temperature: 0.7,
    context_window: 100,
    memory_limit: 100,
    enabled_archived_sessions: true,
  },
  apoc: {
    provider: 'openai',
    model: 'gpt-4',
    temperature: 0.2,
    timeout_ms: 30000,
  }
};
