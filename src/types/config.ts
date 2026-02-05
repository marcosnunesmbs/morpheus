export interface AgentConfig {
  name: string;
  personality: string;
}

export type LLMProvider = 'openai' | 'anthropic' | 'ollama' | 'gemini';

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  temperature: number;
  max_tokens?: number;
  api_key?: string;
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

export type AudioProvider = 'google';

export interface AudioConfig {
  provider: AudioProvider;
  model: string;
  enabled: boolean;
  apiKey?: string;
  maxDurationSeconds: number;
  supportedMimeTypes: string[];
}

export interface SatiConfig extends LLMConfig {
  memory_limit?: number;
}

export interface MemoryConfig {
  /**
   * @deprecated Use llm.context_window instead. This field is kept for backward compatibility.
   */
  limit: number;
}

export interface MorpheusConfig {
  agent: AgentConfig;
  llm: LLMConfig;
  santi?: SatiConfig;
  channels: ChannelsConfig;
  ui: UIConfig;
  logging: LogConfig;
  audio: AudioConfig;
  memory: MemoryConfig;
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
};
