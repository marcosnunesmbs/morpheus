/**
 * Custom error class for AI Provider failures
 */
export class ProviderError extends Error {
  constructor(
    public provider: string,
    public originalError: any,
    public suggestion: string // e.g., "Check your API key via 'morpheus config'"
  ) {
    super(`Provider ${provider} failed: ${originalError?.message || String(originalError)}`);
    this.name = 'ProviderError';
  }
}
