import { StructuredTool } from "@langchain/core/tools";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { loadMCPConfig } from "../../config/mcp-loader.js";
import { DisplayManager } from "../display.js";
import { OAuthManager } from "../oauth/manager.js";
import type { MCPServerConfig } from "../../types/mcp.js";

const display = DisplayManager.getInstance();

/** Fields not supported by Google Gemini API */
const UNSUPPORTED_SCHEMA_FIELDS = ['examples', 'additionalInfo', 'default', '$schema'];

/**
 * Recursively removes unsupported fields from JSON schema objects.
 */
function sanitizeSchema(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeSchema);
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (!UNSUPPORTED_SCHEMA_FIELDS.includes(key)) {
      sanitized[key] = sanitizeSchema(value);
    }
  }
  return sanitized;
}

/**
 * Wraps a tool to sanitize its schema for Gemini compatibility.
 */
function wrapToolWithSanitizedSchema(tool: StructuredTool): StructuredTool {
  const originalSchema = (tool as any).schema;
  if (originalSchema && typeof originalSchema === 'object') {
    (tool as any).schema = sanitizeSchema(originalSchema);
  }
  return tool;
}

/** Timeout (ms) for connecting to each MCP server */
const MCP_CONNECT_TIMEOUT_MS = 60_000;

function connectTimeout(serverName: string, ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(
      () => reject(new Error(`MCP server '${serverName}' timed out after ${ms}ms`)),
      ms,
    ),
  );
}

/** Info about tools loaded from a single MCP server */
export type MCPServerToolInfo = {
  name: string;
  toolCount: number;
  tools: StructuredTool[];
  ok: boolean;
  error?: string;
  loadedAt: Date;
};

/** Summary info for UI display (without full tool objects) */
export type MCPServerStats = {
  name: string;
  toolCount: number;
  ok: boolean;
  error?: string;
};

/** Aggregated stats for all MCP servers */
export type MCPCacheStats = {
  totalTools: number;
  servers: MCPServerStats[];
  lastLoadedAt: Date | null;
  isLoading: boolean;
};

/**
 * MCPToolCache is a singleton that caches MCP tools in memory.
 * 
 * Tools are loaded once at startup (or on first access) and cached.
 * Subsequent calls to `getTools()` return the cached tools instantly.
 * Call `reload()` to refresh tools from MCP servers.
 * 
 * This eliminates the slow re-connection to MCP servers on every agent invocation.
 */
export class MCPToolCache {
  private static instance: MCPToolCache | null = null;

  private allTools: StructuredTool[] = [];
  private serverInfos: MCPServerToolInfo[] = [];
  private lastLoadedAt: Date | null = null;
  private isLoading = false;
  private loadPromise: Promise<void> | null = null;
  private hasLoaded = false;

  private constructor() {}

  static getInstance(): MCPToolCache {
    if (!MCPToolCache.instance) {
      MCPToolCache.instance = new MCPToolCache();
    }
    return MCPToolCache.instance;
  }

  /** Reset singleton - for testing */
  static resetInstance(): void {
    MCPToolCache.instance = null;
  }

  /**
   * Ensure tools are loaded. If already loaded, returns immediately.
   * If loading is in progress, waits for that load to complete.
   * Otherwise, triggers a new load.
   */
  async ensureLoaded(): Promise<void> {
    if (this.hasLoaded) return;

    if (this.isLoading && this.loadPromise) {
      await this.loadPromise;
      return;
    }

    await this.load();
  }

  /**
   * Load tools from all MCP servers. Called once at startup.
   * If already loading, returns the existing promise.
   */
  async load(): Promise<void> {
    if (this.isLoading && this.loadPromise) {
      return this.loadPromise;
    }

    this.isLoading = true;
    this.loadPromise = this._doLoad();

    try {
      await this.loadPromise;
    } finally {
      this.isLoading = false;
      this.loadPromise = null;
    }
  }

  private async _doLoad(): Promise<void> {
    const startTime = Date.now();
    const mcpServers = await loadMCPConfig();
    const serverNames = Object.keys(mcpServers);

    if (serverNames.length === 0) {
      display.log('No MCP servers configured in mcps.json', { level: 'info', source: 'MCPToolCache' });
      this.allTools = [];
      this.serverInfos = [];
      this.lastLoadedAt = new Date();
      this.hasLoaded = true;
      return;
    }

    display.log(`Loading MCP tools from ${serverNames.length} servers...`, { level: 'info', source: 'MCPToolCache' });

    const newTools: StructuredTool[] = [];
    const newServerInfos: MCPServerToolInfo[] = [];

    for (const [serverName, serverConfig] of Object.entries(mcpServers)) {
      const serverStart = Date.now();
      try {
        display.log(`Connecting to MCP server '${serverName}'... (timeout: ${MCP_CONNECT_TIMEOUT_MS/1000}s)`, {
          level: 'info',
          source: 'MCPToolCache',
          meta: { server: serverName, transport: serverConfig.transport }
        });

        let serverTools: StructuredTool[];

        if (serverConfig.transport === 'http') {
          // HTTP MCPs: use MCP SDK directly (supports OAuth auto-discovery)
          serverTools = await Promise.race([
            this.loadHttpMcpServer(serverName, serverConfig as MCPServerConfig & { transport: 'http' }),
            connectTimeout(serverName, MCP_CONNECT_TIMEOUT_MS),
          ]);
        } else {
          // stdio MCPs: use MultiServerMCPClient as before
          serverTools = await Promise.race([
            this.loadStdioMcpServer(serverName, serverConfig),
            connectTimeout(serverName, MCP_CONNECT_TIMEOUT_MS),
          ]);
        }

        // Sanitize schemas for Gemini compatibility
        const sanitizedTools = serverTools.map(wrapToolWithSanitizedSchema);

        newTools.push(...sanitizedTools);
        newServerInfos.push({
          name: serverName,
          toolCount: sanitizedTools.length,
          tools: sanitizedTools,
          ok: true,
          loadedAt: new Date(),
        });

        const elapsed = Date.now() - serverStart;
        display.log(`Loaded ${sanitizedTools.length} tools from '${serverName}' in ${elapsed}ms`, {
          level: 'info',
          source: 'MCPToolCache'
        });
      } catch (error) {
        const elapsed = Date.now() - serverStart;
        const errorMsg = String(error);
        display.log(`Failed to load tools from '${serverName}' (${elapsed}ms): ${errorMsg}`, {
          level: 'warning',
          source: 'MCPToolCache'
        });

        newServerInfos.push({
          name: serverName,
          toolCount: 0,
          tools: [],
          ok: false,
          error: errorMsg,
          loadedAt: new Date(),
        });
      }
    }

    this.allTools = newTools;
    this.serverInfos = newServerInfos;
    this.lastLoadedAt = new Date();
    this.hasLoaded = true;

    const totalElapsed = Date.now() - startTime;
    display.log(`MCP tool cache loaded: ${newTools.length} tools from ${serverNames.length} servers in ${totalElapsed}ms`, {
      level: 'info',
      source: 'MCPToolCache'
    });
  }

  /**
   * Load tools from an HTTP MCP server using MCP SDK directly.
   * Supports OAuth auto-discovery — if the server returns 401,
   * the SDK triggers authorization and the user gets a link.
   */
  private async loadHttpMcpServer(
    serverName: string,
    serverConfig: MCPServerConfig & { transport: 'http' },
  ): Promise<StructuredTool[]> {
    let oauthManager: OAuthManager;
    try {
      oauthManager = OAuthManager.getInstance();
    } catch {
      // OAuthManager not initialized (no port yet) — fall back to basic HTTP
      return this.loadViaMultiServerClient(serverName, serverConfig);
    }

    const { tools, authPending } = await oauthManager.connectHttpMcp(
      serverName,
      serverConfig.url,
      serverConfig.oauth2,
      serverConfig.headers,
    );

    if (authPending) {
      display.log(`MCP '${serverName}': OAuth authorization pending — tools will load after user authorizes`, {
        level: 'info',
        source: 'MCPToolCache',
      });
      return [];
    }

    return tools;
  }

  /**
   * Load tools from a stdio MCP server using MultiServerMCPClient.
   */
  private async loadStdioMcpServer(
    serverName: string,
    serverConfig: Record<string, any>,
  ): Promise<StructuredTool[]> {
    return this.loadViaMultiServerClient(serverName, serverConfig);
  }

  /**
   * Shared fallback: load tools via @langchain/mcp-adapters MultiServerMCPClient.
   */
  private async loadViaMultiServerClient(
    serverName: string,
    serverConfig: Record<string, any>,
  ): Promise<StructuredTool[]> {
    const client = new MultiServerMCPClient({
      mcpServers: { [serverName]: serverConfig } as any,
      onConnectionError: "ignore",
    });

    const tools = await client.getTools();

    // Rename tools with server prefix to avoid collisions
    tools.forEach(tool => {
      const newName = `${serverName}_${tool.name}`;
      Object.defineProperty(tool, "name", { value: newName });
    });

    return tools;
  }

  /**
   * Force reload tools from MCP servers.
   * Clears the cache and loads fresh tools.
   */
  async reload(): Promise<void> {
    this.hasLoaded = false;
    await this.load();
  }

  /**
   * Get all cached MCP tools.
   * Returns cached tools instantly (no server connection).
   * Call `ensureLoaded()` first if tools may not be loaded yet.
   */
  getTools(): StructuredTool[] {
    return this.allTools;
  }

  /**
   * Get detailed info about each MCP server's tools.
   */
  getServerInfos(): MCPServerToolInfo[] {
    return this.serverInfos;
  }

  /**
   * Get stats for UI display (without full tool objects).
   */
  getStats(): MCPCacheStats {
    return {
      totalTools: this.allTools.length,
      servers: this.serverInfos.map(s => ({
        name: s.name,
        toolCount: s.toolCount,
        ok: s.ok,
        error: s.error,
      })),
      lastLoadedAt: this.lastLoadedAt,
      isLoading: this.isLoading,
    };
  }

  /**
   * Check if cache has been loaded at least once.
   */
  isLoaded(): boolean {
    return this.hasLoaded;
  }

  /**
   * Get timestamp of last load (or null if never loaded).
   */
  getLastLoadedAt(): Date | null {
    return this.lastLoadedAt;
  }
}
