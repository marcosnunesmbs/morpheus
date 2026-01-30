// @ts-ignore - Importing from parent project
import type { MorpheusConfig } from '../../../../types/config';

const API_BASE = '/api';

export const configService = {
  fetchConfig: async (): Promise<MorpheusConfig> => {
    const res = await fetch(`${API_BASE}/config`);
    if (!res.ok) {
      throw new Error('Failed to fetch configuration');
    }
    return res.json();
  },

  updateConfig: async (config: MorpheusConfig): Promise<MorpheusConfig> => {
    const res = await fetch(`${API_BASE}/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });
    
    if (!res.ok) {
        const error = await res.json();
        const e = new Error(error.error || 'Failed to update configuration');
        // @ts-ignore
        e.details = error.details;
        throw e;
    }
    return res.json();
  }
};
