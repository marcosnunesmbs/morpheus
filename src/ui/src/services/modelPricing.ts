import { httpClient } from './httpClient';

export interface ModelPricingEntry {
  provider: string;
  model: string;
  input_price_per_1m: number;
  output_price_per_1m: number;
}

export const modelPricingService = {
  list: (): Promise<ModelPricingEntry[]> =>
    httpClient.get<ModelPricingEntry[]>('/model-pricing'),

  upsert: (entry: ModelPricingEntry): Promise<{ success: boolean }> =>
    httpClient.post<{ success: boolean }>('/model-pricing', entry),

  update: (provider: string, model: string, data: Partial<Pick<ModelPricingEntry, 'input_price_per_1m' | 'output_price_per_1m'>>): Promise<{ success: boolean }> =>
    httpClient.put<{ success: boolean }>(`/model-pricing/${encodeURIComponent(provider)}/${encodeURIComponent(model)}`, data),

  delete: (provider: string, model: string): Promise<{ success: boolean }> =>
    httpClient.delete<{ success: boolean }>(`/model-pricing/${encodeURIComponent(provider)}/${encodeURIComponent(model)}`),
};
