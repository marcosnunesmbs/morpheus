// @ts-ignore - Importing from parent project
import type { MorpheusConfig, SatiConfig, ApocConfig, NeoConfig, TrinityConfig, SmithsConfig } from '../../../../types/config';
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

  getEncryptionStatus: async () => {
    return httpClient.get<{
      morpheusSecretSet: boolean;
      apiKeysEncrypted: {
        oracle: boolean;
        sati: boolean;
        neo: boolean;
        apoc: boolean;
        trinity: boolean;
        audio: boolean;
      };
      hasPlaintextKeys: boolean;
    }>('/config/encryption-status');
  },

  getEnvOverrides: async () => {
    return httpClient.get<Record<string, boolean>>('/config/env-overrides');
  },

  getSmithsConfig: async (): Promise<SmithsConfig> => {
    const data = await httpClient.get<any>('/smiths/config');
    return data as SmithsConfig;
  },

  updateSmithsConfig: async (config: Partial<SmithsConfig>): Promise<{ status: string }> => {
    return httpClient.put<{ status: string }>('/smiths/config', config);
  },

  getSmithsList: async () => {
    return httpClient.get<{
      enabled: boolean;
      total: number;
      online: number;
      smiths: Array<{
        name: string;
        host: string;
        port: number;
        state: string;
        capabilities: string[];
        stats: any;
        lastSeen: string | null;
        error: string | null;
      }>;
    }>('/smiths');
  },

  pingSmith: async (name: string) => {
    return httpClient.post<{ name: string; latency_ms: number }>(`/smiths/${name}/ping`, {});
  },

  removeSmith: async (name: string) => {
    return httpClient.delete<{ status: string; name: string }>(`/smiths/${name}`);
  },
};
