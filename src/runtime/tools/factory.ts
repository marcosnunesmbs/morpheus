import { StructuredTool } from "@langchain/core/tools";
import { DisplayManager } from "../display.js";
import { MCPToolCache } from "./cache.js";
import { AuditRepository } from "../audit/repository.js";

const display = DisplayManager.getInstance();

function instrumentMcpTool(tool: StructuredTool, serverName: string, getSessionId: () => string | undefined): StructuredTool {
  // Use a Proxy instead of mutating the cached tool object.
  // Mutating _call directly on the cached object accumulates wrappers across sessions,
  // causing N audit events per tool call after N Neo invocations.
  const toolName = `${serverName}/${tool.name}`;
  return new Proxy(tool, {
    get(target: StructuredTool, prop: string | symbol) {
      if (prop === '_call') {
        return async function(input: any, runManager?: any) {
          const startMs = Date.now();
          const sessionId = getSessionId() ?? 'unknown';
          display.startActivity('neo', `MCP tool: ${tool.name}`);
          try {
            const result = await (target as any)._call(input, runManager);
            const meta: Record<string, unknown> = {};
            if (input && Object.keys(input).length > 0) meta.args = input;
            if (result !== undefined) {
              const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
              meta.result = resultStr.length > 500 ? resultStr.slice(0, 500) + '…' : resultStr;
            }
            AuditRepository.getInstance().insert({
              session_id: sessionId,
              event_type: 'mcp_tool',
              agent: 'neo',
              tool_name: toolName,
              duration_ms: Date.now() - startMs,
              status: 'success',
              metadata: Object.keys(meta).length > 0 ? meta : undefined,
            });
            display.endActivity('neo', true);
            return result;
          } catch (err: any) {
            display.endActivity('neo', false);
            AuditRepository.getInstance().insert({
              session_id: sessionId,
              event_type: 'mcp_tool',
              agent: 'neo',
              tool_name: toolName,
              duration_ms: Date.now() - startMs,
              status: 'error',
              metadata: { error: err?.message ?? String(err) },
            });
            throw err;
          }
        };
      }
      return (target as any)[prop];
    },
  });
}

export type MCPProbeResult = {
  name: string;
  ok: boolean;
  toolCount: number;
  error?: string;
};

export class Construtor {
  /**
   * Probe MCP servers by checking cache stats.
   * If cache is not loaded, loads it first.
   */
  static async probe(): Promise<MCPProbeResult[]> {
    const cache = MCPToolCache.getInstance();
    await cache.ensureLoaded();

    const stats = cache.getStats();
    return stats.servers.map(s => ({
      name: s.name,
      ok: s.ok,
      toolCount: s.toolCount,
      error: s.error,
    }));
  }

  /**
   * Get MCP tools from cache (fast path).
   * If cache is not loaded, loads it first.
   * Tools are cached and returned instantly on subsequent calls.
   * If getSessionId is provided, tools are wrapped with audit instrumentation.
   */
  static async create(getSessionId?: () => string | undefined): Promise<StructuredTool[]> {
    const cache = MCPToolCache.getInstance();
    await cache.ensureLoaded();

    const tools = cache.getTools();
    display.log(`Returning ${tools.length} cached MCP tools`, { level: 'debug', source: 'Construtor' });

    if (!getSessionId) return tools;

    // Wrap each tool with audit tracking; derive server name from tool name prefix
    return tools.map(tool => {
      const serverName = (tool as any).serverName ?? tool.name.split('_')[0] ?? 'mcp';
      return instrumentMcpTool(tool, serverName, getSessionId);
    });
  }

  /**
   * Force reload MCP tools from servers (slow path).
   * Use when MCP configuration changes.
   */
  static async reload(): Promise<void> {
    const cache = MCPToolCache.getInstance();
    await cache.reload();
  }

  /**
   * Get cache stats for UI display.
   */
  static getStats() {
    return MCPToolCache.getInstance().getStats();
  }
}
