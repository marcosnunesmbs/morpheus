import type { OAuthTokens, OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';

export { OAuthTokens, OAuthClientInformationFull };

/** Persisted data for a single MCP server's OAuth state */
export interface OAuthServerRecord {
  tokens?: OAuthTokens;
  clientInfo?: OAuthClientInformationFull;
  /** PKCE code_verifier keyed by state parameter */
  pkce?: Record<string, string>;
}

/** Shape of ~/.morpheus/oauth-tokens.json */
export type OAuthStoreData = Record<string, OAuthServerRecord>;

/** Status of an OAuth-enabled MCP server */
export type OAuthServerStatus = {
  name: string;
  status: 'authorized' | 'pending_auth' | 'expired' | 'no_token';
  expiresAt?: number;
};
