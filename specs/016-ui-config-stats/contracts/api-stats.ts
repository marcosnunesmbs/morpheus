export interface UsageStats {
  /**
   * total aggregated input tokens from all stored messages
   */
  totalInputTokens: number;
  
  /**
   * total aggregated output tokens from all stored messages
   */
  totalOutputTokens: number;
}

export interface GetUsageStatsResponse extends UsageStats {}
