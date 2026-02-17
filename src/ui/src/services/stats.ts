import { httpClient } from './httpClient';

export interface UsageStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalEstimatedCostUsd: number | null;
}

export interface ProviderModelUsageStats {
  provider: string;
  model: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  messageCount: number;
  totalAudioSeconds: number;
  estimatedCostUsd: number | null;
}

export const statsService = {
  fetchUsageStats: async (): Promise<UsageStats> => {
    return httpClient.get<UsageStats>('/stats/usage');
  },
  
  fetchGroupedUsageStats: async (): Promise<ProviderModelUsageStats[]> => {
    return httpClient.get<ProviderModelUsageStats[]>('/stats/usage/grouped');
  }
};
