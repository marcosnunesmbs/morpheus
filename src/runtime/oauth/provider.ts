import type {
  OAuthClientProvider,
} from '@modelcontextprotocol/sdk/client/auth.js';
import type {
  OAuthClientMetadata,
  OAuthClientInformationMixed,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import crypto from 'crypto';
import { OAuthStore } from './store.js';

/**
 * Morpheus implementation of OAuthClientProvider from the MCP SDK.
 * Delegates persistence to OAuthStore and user notification to a callback.
 */
export class MorpheusOAuthProvider implements OAuthClientProvider {
  private _lastState: string | undefined;

  constructor(
    private serverName: string,
    private store: OAuthStore,
    private notifyUser: (url: URL) => Promise<void>,
    private _redirectUri: string,
    private _scope?: string,
    private _clientId?: string,
    private _clientSecret?: string,
    private _grantType?: 'client_credentials' | 'authorization_code',
  ) {}

  get redirectUrl(): string | URL | undefined {
    if (this._grantType === 'client_credentials') return undefined;
    return this._redirectUri;
  }

  get clientMetadata(): OAuthClientMetadata {
    const meta: OAuthClientMetadata = {
      redirect_uris: [new URL(this._redirectUri)] as any,
      client_name: `Morpheus - ${this.serverName}`,
      grant_types: this._grantType === 'client_credentials'
        ? ['client_credentials']
        : ['authorization_code', 'refresh_token'],
      response_types: this._grantType === 'client_credentials' ? [] : ['code'],
    };
    if (this._scope) meta.scope = this._scope;
    return meta;
  }

  async state(): Promise<string> {
    this._lastState = crypto.randomUUID();
    return this._lastState;
  }

  async clientInformation(): Promise<OAuthClientInformationMixed | undefined> {
    // If user provided client_id, return it as pre-registered info
    if (this._clientId) {
      return {
        client_id: this._clientId,
        client_secret: this._clientSecret,
      };
    }
    // Otherwise check store for dynamically registered client info
    return this.store.getClientInfo(this.serverName);
  }

  async saveClientInformation(info: OAuthClientInformationMixed): Promise<void> {
    // OAuthClientInformationFull has client_id_issued_at
    this.store.saveClientInfo(this.serverName, info as any);
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    return this.store.getTokens(this.serverName);
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    this.store.saveTokens(this.serverName, tokens);
  }

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    await this.notifyUser(authorizationUrl);
  }

  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    const state = this._lastState ?? '__default';
    this.store.savePkceVerifier(this.serverName, state, codeVerifier);
  }

  async codeVerifier(): Promise<string> {
    const verifier = this.store.getLatestPkceVerifier(this.serverName);
    if (!verifier) throw new Error(`No PKCE code verifier found for ${this.serverName}`);
    return verifier;
  }

  async invalidateCredentials(scope: 'all' | 'client' | 'tokens' | 'verifier'): Promise<void> {
    if (scope === 'all' || scope === 'tokens') {
      this.store.deleteTokens(this.serverName);
    }
    if (scope === 'all') {
      this.store.deleteServer(this.serverName);
    }
  }
}
