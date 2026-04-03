import { spawn } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

import { ConfigManager } from '../../config/manager.js';
import { DisplayManager } from '../display.js';
import { resolveGwsScopes, getDefaultGwsScopes } from './scopes.js';
import type { GwsOAuthStatus, GwsSetupResult, GwsRefreshResult } from './types.js';

/** Checks if a binary is available in the system PATH */
function isBinaryAvailable(name: string): boolean {
  try {
    const command = process.platform === 'win32' ? `where ${name}` : `which ${name}`;
    execSync(command, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * GwsOAuthManager — orchestrates OAuth 2.0 flow for Google Workspace.
 *
 * The `gws auth login` CLI opens the browser automatically for authorization.
 * We spawn it in the background and poll for token completion.
 */
/** Extracts the first Google OAuth URL from a text buffer */
function extractAuthUrl(text: string): string | null {
  const match = text.match(/(https:\/\/accounts\.google\.com\/o\/oauth2[^\s"']+)/);
  return match?.[1] ?? null;
}

export class GwsOAuthManager {
  private static instance: GwsOAuthManager | null = null;

  private display: DisplayManager;
  private setupInProgress = false;
  private pendingAuthUrl: string | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private gwsProcess: ReturnType<typeof spawn> | null = null;

  private constructor() {
    this.display = DisplayManager.getInstance();
  }

  static getInstance(): GwsOAuthManager {
    if (!GwsOAuthManager.instance) {
      GwsOAuthManager.instance = new GwsOAuthManager();
    }
    return GwsOAuthManager.instance;
  }

  static resetInstance(): void {
    GwsOAuthManager.instance?.cleanup();
    GwsOAuthManager.instance = null;
  }

  // ── Binary Check ──────────────────────────────────────

  isGwsBinaryAvailable(): boolean {
    return isBinaryAvailable('gws');
  }

  // ── Setup Flow ────────────────────────────────────────

  /** Returns the captured auth URL if setup is in progress */
  getPendingAuthUrl(): string | null {
    return this.pendingAuthUrl;
  }

  async setup(scopes?: string[]): Promise<GwsSetupResult> {
    if (!this.isGwsBinaryAvailable()) {
      throw new Error(
        'Google Workspace CLI (gws) not found in system PATH. ' +
        'Install with: npm install -g @googleworkspace/cli',
      );
    }

    if (this.setupInProgress && this.pendingAuthUrl) {
      return {
        url: this.pendingAuthUrl,
        status: 'pending_auth',
        message: 'OAuth setup already in progress. Use the link below to authorize.',
      };
    }

    const resolvedScopes = resolveGwsScopes(
      scopes && scopes.length > 0 ? scopes : getDefaultGwsScopes(),
    );

    this.display.log('Starting GWS OAuth setup...', {
      source: 'GwsOAuth',
      level: 'info',
      meta: { scopes: resolvedScopes },
    });

    // Spawn gws auth login — it prints the auth URL to stderr
    // On Windows with shell: true, stderr piping can be unreliable for .cmd wrappers,
    // so we merge stderr into stdout (stdio fd 2 → fd 1) to guarantee capture.
    this.gwsProcess = spawn('gws', ['auth', 'login', '--scopes', resolvedScopes.join(',')], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      env: { ...process.env },
    });

    // Capture both stdout and stderr to extract the authorization URL
    let outputBuffer = '';
    const urlPromise = new Promise<string | null>((resolve) => {
      const timeout = setTimeout(() => resolve(null), 15_000);
      let resolved = false;

      const onData = (chunk: Buffer) => {
        outputBuffer += chunk.toString();
        if (resolved) return;
        const url = extractAuthUrl(outputBuffer);
        if (url) {
          resolved = true;
          clearTimeout(timeout);
          resolve(url);
        }
      };

      this.gwsProcess!.stdout?.on('data', onData);
      this.gwsProcess!.stderr?.on('data', onData);

      this.gwsProcess!.on('error', () => {
        if (!resolved) { clearTimeout(timeout); resolve(null); }
      });
      this.gwsProcess!.on('exit', () => {
        if (!resolved) { clearTimeout(timeout); resolve(extractAuthUrl(outputBuffer)); }
      });
    });

    this.gwsProcess.on('exit', (code) => {
      this.gwsProcess = null;
      this.display.log(`gws auth login exited with code ${code}. ${outputBuffer.trim()}`, {
        source: 'GwsOAuth',
        level: code === 0 ? 'info' : 'warning',
      });
    });

    this.gwsProcess.unref();

    this.setupInProgress = true;
    this.startTokenPolling(300_000);

    // Wait for the URL to appear in stdout/stderr
    const authUrl = await urlPromise;

    this.display.log(`gws output buffer (${outputBuffer.length} chars): ${outputBuffer.slice(0, 200)}`, {
      source: 'GwsOAuth',
      level: 'debug',
    });
    this.pendingAuthUrl = authUrl;

    if (authUrl) {
      this.display.log(`GWS OAuth URL captured: ${authUrl.slice(0, 80)}...`, {
        source: 'GwsOAuth',
        level: 'info',
      });
    } else {
      this.display.log('gws CLI launched but could not capture auth URL from output.', {
        source: 'GwsOAuth',
        level: 'warning',
      });
    }

    return {
      url: authUrl ?? '',
      status: 'pending_auth',
      message: authUrl
        ? 'Click the link below to authorize your Google Account.'
        : 'Authorization page opened in your browser. Complete the OAuth flow there.',
    };
  }

  // ── Token Polling ─────────────────────────────────────

  private startTokenPolling(timeoutMs: number): void {
    const startTime = Date.now();

    this.pollInterval = setInterval(async () => {
      const elapsed = Date.now() - startTime;
      if (elapsed > timeoutMs) {
        this.stopTokenPolling();
        this.setupInProgress = false;
        this.display.log('GWS OAuth setup timed out. Please run setup again.', {
          source: 'GwsOAuth',
          level: 'warning',
        });
        return;
      }

      const status = await this.detectAuthStatus();
      if (status.status === 'authorized') {
        this.stopTokenPolling();
        this.setupInProgress = false;
        this.display.log('✅ GWS OAuth setup complete! Tokens saved successfully.', {
          source: 'GwsOAuth',
          level: 'info',
        });
      }
    }, 3_000); // Poll every 3 seconds
  }

  private stopTokenPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  // ── Status Detection ──────────────────────────────────

  async getStatus(): Promise<GwsOAuthStatus> {
    const config = ConfigManager.getInstance().getGwsConfig();
    const authMethod = config.auth_method ?? 'service_account';

    if (authMethod === 'service_account') {
      return this.getServiceAccountStatus(config);
    }

    return this.detectAuthStatus();
  }

  private async detectAuthStatus(): Promise<GwsOAuthStatus> {
    const binaryAvailable = this.isGwsBinaryAvailable();

    if (!binaryAvailable) {
      return {
        auth_method: 'oauth',
        status: 'error',
        scopes: [],
        binary_available: false,
        error_message: 'gws CLI binary not found',
      };
    }

    const credsPath = this.getGwsCredentialsPath();
    const credsExist = await fs.pathExists(credsPath);

    if (!credsExist) {
      return {
        auth_method: 'oauth',
        status: this.setupInProgress ? 'pending' : 'not_configured',
        scopes: [],
        binary_available: true,
        auth_url: this.setupInProgress ? this.pendingAuthUrl ?? undefined : undefined,
      };
    }

    // Try to get detailed status via gws CLI
    try {
      const statusOutput = execSync('gws auth status --json', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
        timeout: 10_000,
      });

      const parsed = JSON.parse(statusOutput);
      const expiresAt = parsed.expires_at
        ? new Date(parsed.expires_at).getTime()
        : undefined;

      return {
        auth_method: 'oauth',
        status: parsed.valid ? 'authorized' : 'expired',
        scopes: parsed.scopes ?? [],
        expires_at: expiresAt,
        binary_available: true,
      };
    } catch {
      // If gws status check fails but creds file exists, assume authorized
      return {
        auth_method: 'oauth',
        status: 'authorized',
        scopes: [],
        binary_available: true,
      };
    }
  }

  private getServiceAccountStatus(config: { service_account_json?: string }): GwsOAuthStatus {
    if (config.service_account_json) {
      return {
        auth_method: 'service_account',
        status: 'authorized',
        scopes: [],
        binary_available: this.isGwsBinaryAvailable(),
      };
    }

    return {
      auth_method: 'service_account',
      status: 'not_configured',
      scopes: [],
      binary_available: this.isGwsBinaryAvailable(),
    };
  }

  private getGwsCredentialsPath(): string {
    return path.join(os.homedir(), '.config', 'gws', 'credentials.json');
  }

  // ── Revoke ────────────────────────────────────────────

  async revoke(): Promise<void> {
    const credsPath = this.getGwsCredentialsPath();

    if (await fs.pathExists(credsPath)) {
      await fs.remove(credsPath);
      this.display.log('GWS OAuth tokens revoked.', {
        source: 'GwsOAuth',
        level: 'info',
      });
    }

    this.cleanup();
  }

  // ── Refresh ───────────────────────────────────────────

  async refresh(scopes?: string[]): Promise<GwsRefreshResult> {
    const status = await this.getStatus();

    if (status.status === 'authorized') {
      return {
        status: 'already_valid',
        message: 'OAuth tokens are already valid.',
      };
    }

    this.display.log('GWS OAuth tokens expired. Refreshing...', {
      source: 'GwsOAuth',
      level: 'info',
    });

    try {
      await this.setup(scopes);
      return {
        status: 'refreshed',
        message: 'OAuth refresh initiated. Complete authorization in your browser.',
      };
    } catch (error: any) {
      throw new Error(`Failed to refresh OAuth tokens: ${error.message}`);
    }
  }

  // ── Cleanup ───────────────────────────────────────────

  cleanup(): void {
    this.setupInProgress = false;
    this.pendingAuthUrl = null;
    if (this.gwsProcess) {
      this.gwsProcess.kill();
      this.gwsProcess = null;
    }
    this.stopTokenPolling();
  }
}
