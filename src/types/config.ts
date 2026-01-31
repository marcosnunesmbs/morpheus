export interface AgentConfig {
  name: string;
  personality: string;
}

export type LLMProvider = 'openai' | 'anthropic' | 'ollama' | 'gemini';

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  temperature: number;
  api_key?: string;
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

export interface AudioConfig {
  enabled: boolean;
  apiKey?: string;
  maxDurationSeconds: number;
  supportedMimeTypes: string[];
}

export interface MorpheusConfig {
  agent: AgentConfig;
  llm: LLMConfig;
  channels: ChannelsConfig;
  ui: UIConfig;
  logging: LogConfig;
  audio: AudioConfig;
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
    enabled: true,
    maxDurationSeconds: 300,
    supportedMimeTypes: ['audio/ogg', 'audio/mp3', 'audio/mpeg', 'audio/wav'],
  },
  llm: {
    provider: 'openai',
    model: 'gpt-4',
    temperature: 0.7,
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
