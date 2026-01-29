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

export interface MorpheusConfig {
  agent: AgentConfig;
  llm: LLMConfig;
  channels: ChannelsConfig;
  ui: UIConfig;
}

export const DEFAULT_CONFIG: MorpheusConfig = {
  agent: {
    name: 'morpheus',
    personality: 'helpful_dev',
  },
  llm: {
    provider: 'openai',
    model: 'gpt-4',
    temperature: 0.7,
  },
  channels: {
    telegram: { enabled: false },
    discord: { enabled: false },
  },
  ui: {
    enabled: true,
    port: 3333,
  },
};
