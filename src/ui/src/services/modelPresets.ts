import { httpClient } from './httpClient';

export interface ModelPresetEntry {
  id: string;
  name: string;
  provider: string;
  model: string;
  has_api_key: boolean;
  base_url?: string | null;
  temperature?: number | null;
  max_tokens?: number | null;
  created_at: string;
  updated_at: string;
}

export interface ModelPresetFormData {
  name: string;
  provider: string;
  model: string;
  api_key?: string | null;
  base_url?: string | null;
  temperature?: number | null;
  max_tokens?: number | null;
}

export const modelPresetsService = {
  list: (): Promise<ModelPresetEntry[]> =>
    httpClient.get<ModelPresetEntry[]>('/model-presets'),

  create: (data: ModelPresetFormData): Promise<{ id: string; success: boolean }> =>
    httpClient.post<{ id: string; success: boolean }>('/model-presets', data),

  update: (id: string, data: ModelPresetFormData): Promise<{ success: boolean }> =>
    httpClient.put<{ success: boolean }>(`/model-presets/${encodeURIComponent(id)}`, data),

  delete: (id: string): Promise<{ success: boolean }> =>
    httpClient.delete<{ success: boolean }>(`/model-presets/${encodeURIComponent(id)}`),

  decryptApiKey: (id: string): Promise<{ api_key: string | null; error?: string }> =>
    httpClient.get(`/model-presets/${encodeURIComponent(id)}/decrypt`),
};
