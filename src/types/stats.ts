export interface ModelPricingEntry {
  provider: string;
  model: string;
  input_price_per_1m: number;
  output_price_per_1m: number;
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
