// @ts-ignore
import type { UsageStats } from '../../../../specs/016-ui-config-stats/contracts/api-stats';
import { httpClient } from './httpClient';

export const statsService = {
  fetchUsageStats: async (): Promise<UsageStats> => {
    return httpClient.get<UsageStats>('/stats/usage');
  }
};
