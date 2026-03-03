import { httpClient } from './httpClient.js';

export type ResetCategory = 'sessions' | 'memories' | 'tasks' | 'audit' | 'chronos' | 'webhooks';

export interface ResetResult {
  success: boolean;
  message: string;
  categories: ResetCategory[];
  deleted: Record<string, number>;
}

export const dangerService = {
  resetData: async (categories: ResetCategory[]): Promise<ResetResult> => {
    return httpClient.delete<ResetResult>('/danger/reset', { categories });
  },
};
