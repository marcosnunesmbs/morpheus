// @ts-ignore - Importing from parent project
import type { MorpheusConfig } from '../../../../types/config';
import { httpClient } from './httpClient';

export const configService = {
  fetchConfig: async (): Promise<MorpheusConfig> => {
    return httpClient.get<MorpheusConfig>('/config');
  },

  updateConfig: async (config: MorpheusConfig): Promise<MorpheusConfig> => {
    return httpClient.post<MorpheusConfig>('/config', config);
  }
};
