// @ts-ignore - Importing from parent project
import type { MorpheusConfig, SatiConfig, ApocConfig, NeoConfig, TrinityConfig } from '../../../../types/config';
import { httpClient } from './httpClient';

export const configService = {
  fetchConfig: async (): Promise<MorpheusConfig> => {
    return httpClient.get<MorpheusConfig>('/config');
  },

  updateConfig: async (config: MorpheusConfig): Promise<MorpheusConfig> => {
    return httpClient.post<MorpheusConfig>('/config', config);
  },

  getSatiConfig: async (): Promise<SatiConfig> => {
    return httpClient.get<SatiConfig>('/config/sati');
  },

  updateSatiConfig: async (config: SatiConfig): Promise<{ success: boolean }> => {
    return httpClient.post<{ success: boolean }>('/config/sati', config);
  },

  deleteSatiConfig: async (): Promise<{ success: boolean }> => {
    return httpClient.delete<{ success: boolean }>('/config/sati');
  },

  getApocConfig: async (): Promise<ApocConfig> => {
    return httpClient.get<ApocConfig>('/config/apoc');
  },

  updateApocConfig: async (config: ApocConfig): Promise<{ success: boolean }> => {
    return httpClient.post<{ success: boolean }>('/config/apoc', config);
  },

  deleteApocConfig: async (): Promise<{ success: boolean }> => {
    return httpClient.delete<{ success: boolean }>('/config/apoc');
  },

  getNeoConfig: async (): Promise<NeoConfig> => {
    return httpClient.get<NeoConfig>('/config/neo');
  },

  updateNeoConfig: async (config: NeoConfig): Promise<{ success: boolean }> => {
    return httpClient.post<{ success: boolean }>('/config/neo', config);
  },

  deleteNeoConfig: async (): Promise<{ success: boolean }> => {
    return httpClient.delete<{ success: boolean }>('/config/neo');
  },

  getTrinityConfig: async (): Promise<TrinityConfig> => {
    return httpClient.get<TrinityConfig>('/config/trinity');
  },

  updateTrinityConfig: async (config: TrinityConfig): Promise<{ success: boolean }> => {
    return httpClient.post<{ success: boolean }>('/config/trinity', config);
  },

  deleteTrinityConfig: async (): Promise<{ success: boolean }> => {
    return httpClient.delete<{ success: boolean }>('/config/trinity');
  },
};
