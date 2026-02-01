// @ts-ignore
import type { UsageStats } from '../../../../specs/016-ui-config-stats/contracts/api-stats';

const API_BASE = '/api';

export const statsService = {
  fetchUsageStats: async (): Promise<UsageStats> => {
    const res = await fetch(`${API_BASE}/stats/usage`);
    if (!res.ok) {
      throw new Error('Failed to fetch usage stats');
    }
    return res.json();
  }
};
