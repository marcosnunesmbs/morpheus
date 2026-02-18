import { httpClient } from './httpClient';

export interface SubAgentConfig {
  provider?: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  api_key?: string;
  base_url?: string;
  timeout_ms?: number;
  system_prompt?: string;
}

export interface AgentsConfig {
  architect?: SubAgentConfig;
  keymaker?: SubAgentConfig;
  apoc?: SubAgentConfig;
  merovingian?: SubAgentConfig;
}

export const agentConfigService = {
  get: () => httpClient.get<AgentsConfig>('/config/agents'),

  update: (config: AgentsConfig) =>
    httpClient.post<{ success: boolean }>('/config/agents', config),
};
