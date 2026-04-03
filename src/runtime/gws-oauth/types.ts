import type { GwsAuthMethod } from '../../types/config.js';

/** Status of GWS OAuth authentication */
export interface GwsOAuthStatus {
  auth_method: GwsAuthMethod;
  status: 'authorized' | 'pending' | 'expired' | 'error' | 'not_configured';
  scopes: string[];
  expires_at?: number;
  binary_available: boolean;
  error_message?: string;
  /** Authorization URL captured from gws CLI (available while status is 'pending') */
  auth_url?: string;
}

/** Result of initiating GWS OAuth setup */
export interface GwsSetupResult {
  url: string;
  status: 'pending_auth';
  message: string;
}

/** Result of refreshing GWS OAuth tokens */
export interface GwsRefreshResult {
  status: 'refreshed' | 'already_valid';
  expires_at?: number;
  message?: string;
}
