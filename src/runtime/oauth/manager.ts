import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StructuredTool, DynamicStructuredTool } from '@langchain/core/tools';

import { OAuthStore } from './store.js';
import { MorpheusOAuthProvider } from './provider.js';
import { DisplayManager } from '../display.js';
import type { OAuthServerStatus } from './types.js';
import type { OAuth2Config } from '../../types/mcp.js';

const display = DisplayManager.getInstance();

/** Tracks a pending OAuth connection awaiting user authorization */
interface PendingAuth {
  transport: StreamableHTTPClientTransport;
  provider: MorpheusOAuthProvider;
  serverUrl: string;
}

/**
 * OAuthManager — singleton coordinating OAuth 2 flows for HTTP MCP servers.
 *
 * Responsibilities:
 * - Creates MorpheusOAuthProvider per server
 * - Tracks pending transports awaiting user authorization (auth_code flow)
 * - Handles callback (finishAuth) after user authorizes
 * - Provides status of all OAuth MCP servers
 */
export class OAuthManager {
  private static instance: OAuthManager | null = null;

  private store: OAuthStore;
  private pending = new Map<string, PendingAuth>();
  private redirectUri: string;
  private notifyFn: ((serverName: string, url: URL) => Promise<void>) | null = null;

  private constructor(port: number) {
    this.store = OAuthStore.getInstance();
    this.redirectUri = `http://localhost:${port}/api/oauth/callback`;
  }

  static getInstance(port?: number): OAuthManager {
    if (!OAuthManager.instance) {
      if (!port) throw new Error('OAuthManager.getInstance() requires port on first call');
      OAuthManager.instance = new OAuthManager(port);
    }
    return OAuthManager.instance;
  }

  static resetInstance(): void {
    OAuthManager.instance = null;
  }

  /** Set the notification function (called when user needs to authorize) */
  setNotifyFn(fn: (serverName: string, url: URL) => Promise<void>): void {
    this.notifyFn = fn;
  }

  getRedirectUri(): string {
    return this.redirectUri;
  }

  // ── Connection ────────────────────────────────────────

  /**
   * Attempt to connect to an HTTP MCP server with OAuth support.
   * Returns loaded tools if successful, or empty array if auth is pending.
   */
  async connectHttpMcp(
    serverName: string,
    serverUrl: string,
    oauth2Config?: OAuth2Config,
    extraHeaders?: Record<string, string>,
  ): Promise<{ tools: StructuredTool[]; authPending: boolean }> {
    const provider = new MorpheusOAuthProvider(
      serverName,
      this.store,
      async (url: URL) => {
        display.log(`MCP '${serverName}' requires OAuth authorization`, {
          level: 'info',
          source: 'OAuth',
          meta: { url: url.toString() },
        });
        if (this.notifyFn) {
          await this.notifyFn(serverName, url);
        }
      },
      this.redirectUri,
      oauth2Config?.scope,
      oauth2Config?.client_id,
      oauth2Config?.client_secret,
      oauth2Config?.grant_type,
    );

    const transportUrl = new URL(serverUrl);
    const transport = new StreamableHTTPClientTransport(transportUrl, {
      authProvider: provider,
      requestInit: extraHeaders ? { headers: extraHeaders } : undefined,
    });

    try {
      const client = new Client({ name: `morpheus-${serverName}`, version: '1.0.0' });
      await client.connect(transport);

      // Connection succeeded — extract tools
      const { tools: toolDefs } = await client.listTools();
      const tools = toolDefs.map((td) => this.mcpToolToStructuredTool(serverName, td, client));

      display.log(`OAuth MCP '${serverName}': loaded ${tools.length} tools`, {
        level: 'info',
        source: 'OAuth',
      });

      return { tools, authPending: false };
    } catch (error: any) {
      // Check if auth redirect was triggered (SDK calls redirectToAuthorization)
      if (error?.message?.includes('Unauthorized') || error?.code === 401) {
        display.log(`OAuth MCP '${serverName}': authorization required, waiting for user`, {
          level: 'info',
          source: 'OAuth',
        });
        this.pending.set(serverName, { transport, provider, serverUrl });
        return { tools: [], authPending: true };
      }

      // The SDK may throw after calling redirectToAuthorization for auth_code flow.
      // Check if we have a pending state for this server (set during redirectToAuthorization).
      const hasPkce = this.store.getLatestPkceVerifier(serverName);
      if (hasPkce) {
        display.log(`OAuth MCP '${serverName}': authorization redirect sent, waiting for callback`, {
          level: 'info',
          source: 'OAuth',
        });
        this.pending.set(serverName, { transport, provider, serverUrl });
        return { tools: [], authPending: true };
      }

      throw error;
    }
  }

  // ── Callback ──────────────────────────────────────────

  /**
   * Handle OAuth callback after user authorizes.
   * Called by GET /api/oauth/callback?code=...&state=...
   */
  async finishAuth(code: string, state?: string): Promise<{ serverName: string; toolCount: number }> {
    // Resolve which server this callback is for
    let serverName: string | undefined;
    if (state) {
      serverName = this.store.resolveServerByState(state);
    }
    if (!serverName) {
      // Fallback: use the only pending server if there's just one
      const pendingNames = [...this.pending.keys()];
      if (pendingNames.length === 1) {
        serverName = pendingNames[0];
      }
    }

    if (!serverName) {
      throw new Error('Could not resolve OAuth callback: unknown state parameter');
    }

    const entry = this.pending.get(serverName);
    if (!entry) {
      throw new Error(`No pending OAuth flow for server '${serverName}'`);
    }

    // Complete the auth flow — SDK exchanges code for token
    await entry.transport.finishAuth(code);
    this.pending.delete(serverName);

    // Clean up PKCE
    if (state) this.store.deletePkce(serverName, state);

    // Now reconnect to get tools
    const client = new Client({ name: `morpheus-${serverName}`, version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL(entry.serverUrl), {
      authProvider: entry.provider,
    });
    await client.connect(transport);
    const { tools: toolDefs } = await client.listTools();

    display.log(`OAuth MCP '${serverName}': authorized! ${toolDefs.length} tools available`, {
      level: 'info',
      source: 'OAuth',
    });

    return { serverName, toolCount: toolDefs.length };
  }

  // ── Status ────────────────────────────────────────────

  getStatus(): OAuthServerStatus[] {
    const statuses: OAuthServerStatus[] = [];
    for (const name of this.store.listServers()) {
      const tokens = this.store.getTokens(name);
      if (!tokens) {
        statuses.push({ name, status: this.pending.has(name) ? 'pending_auth' : 'no_token' });
        continue;
      }
      // OAuthTokens may have expires_in but not expires_at — check if present
      const expiresAt = (tokens as any).expires_at as number | undefined;
      if (expiresAt && Date.now() > expiresAt) {
        statuses.push({ name, status: 'expired', expiresAt });
      } else {
        statuses.push({ name, status: 'authorized', expiresAt });
      }
    }
    // Add pending servers that aren't in the store yet
    for (const name of this.pending.keys()) {
      if (!statuses.find(s => s.name === name)) {
        statuses.push({ name, status: 'pending_auth' });
      }
    }
    return statuses;
  }

  isPending(serverName: string): boolean {
    return this.pending.has(serverName);
  }

  // ── Revoke ────────────────────────────────────────────

  revokeToken(serverName: string): void {
    this.store.deleteTokens(serverName);
    this.pending.delete(serverName);
    display.log(`OAuth tokens revoked for MCP '${serverName}'`, {
      level: 'info',
      source: 'OAuth',
    });
  }

  // ── Internal: convert MCP tool def to LangChain StructuredTool ──

  private mcpToolToStructuredTool(
    serverName: string,
    toolDef: { name: string; description?: string; inputSchema?: any },
    mcpClient: Client,
  ): StructuredTool {
    const prefixedName = `${serverName}_${toolDef.name}`;
    const originalToolName = toolDef.name;

    // Pass raw JSON Schema directly (same approach as @langchain/mcp-adapters).
    // Avoids Zod v4 $required serialization issues with LangChain's zodToJsonSchema.
    const rawSchema = toolDef.inputSchema ?? { type: 'object', properties: {} };
    if (!rawSchema.properties) rawSchema.properties = {};

    return new DynamicStructuredTool({
      name: prefixedName,
      description: toolDef.description || `MCP tool ${toolDef.name} from ${serverName}`,
      schema: rawSchema as any,
      func: async (input: Record<string, any>) => {
        try {
          const result = await mcpClient.callTool({
            name: originalToolName,
            arguments: input,
          });
          if (Array.isArray(result.content)) {
            return result.content
              .map((c: any) => c.text ?? JSON.stringify(c))
              .join('\n');
          }
          return typeof result.content === 'string'
            ? result.content
            : JSON.stringify(result.content);
        } catch (error: any) {
          return `Error calling MCP tool ${originalToolName}: ${error.message}`;
        }
      },
    });
  }
}
