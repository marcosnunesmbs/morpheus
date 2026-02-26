import { StructuredTool } from "@langchain/core/tools";
import { DisplayManager } from "../display.js";
import { MCPToolCache } from "./cache.js";

const display = DisplayManager.getInstance();

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
   */
  static async create(): Promise<StructuredTool[]> {
    const cache = MCPToolCache.getInstance();
    await cache.ensureLoaded();

    const tools = cache.getTools();
    display.log(`Returning ${tools.length} cached MCP tools`, { level: 'debug', source: 'Construtor' });
    return tools;
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
