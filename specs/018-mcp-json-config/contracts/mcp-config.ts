/**
 * MCP Configuration Contracts
 * Feature: 018-mcp-json-config
 * 
 * These interfaces define the contract for MCP server configuration.
 * Implementation must adhere to these types.
 */

import { z } from 'zod';

// ============================================================================
// Zod Schemas (for validation)
// ============================================================================

/**
 * Schema for a single MCP server configuration entry.
 * Matches the structure expected by @langchain/mcp-adapters MultiServerMCPClient.
 */
export const MCPServerConfigSchema = z.object({
  /** Transport protocol - stdio for command-line tools, http for HTTP servers */
  transport: z.enum(['stdio', 'http']),
  
  /** Command to execute (e.g., "npx", "node", "python") */
  command: z.string().min(1, 'Command is required'),
  
  /** Command arguments */
  args: z.array(z.string()).optional().default([]),
  
  /** Environment variables to pass to the process */
  env: z.record(z.string(), z.string()).optional().default({}),
  
  /** Optional comment (ignored at runtime) */
  _comment: z.string().optional(),
});

/**
 * Schema for the entire mcps.json file.
 * Allows arbitrary server names as keys.
 */
export const MCPConfigFileSchema = z.record(
  z.string(),
  z.union([
    MCPServerConfigSchema,
    z.string(), // For _comment, _docs, $schema fields
  ])
);

// ============================================================================
// TypeScript Types (derived from Zod schemas)
// ============================================================================

/** Configuration for a single MCP server */
export type MCPServerConfig = z.infer<typeof MCPServerConfigSchema>;

/** The structure of mcps.json file (raw, before filtering) */
export type MCPConfigFileRaw = z.infer<typeof MCPConfigFileSchema>;

/** Clean MCP servers config (after filtering metadata keys) */
export type MCPServersConfig = Record<string, MCPServerConfig>;

// ============================================================================
// Loader Interface
// ============================================================================

/**
 * Result of loading MCP configuration.
 */
export interface MCPLoadResult {
  /** Successfully validated MCP server configurations */
  servers: MCPServersConfig;
  
  /** Servers that failed validation (name -> error message) */
  errors: Record<string, string>;
  
  /** Whether the config file existed */
  fileExists: boolean;
}

/**
 * Interface for MCP configuration loader.
 * Implementations must handle missing files, invalid JSON, and partial validation.
 */
export interface IMCPConfigLoader {
  /**
   * Load and validate MCP configuration from file.
   * @returns MCPLoadResult with valid servers and any errors
   */
  load(): Promise<MCPLoadResult>;
  
  /**
   * Check if configuration file exists.
   */
  exists(): Promise<boolean>;
  
  /**
   * Create default template file.
   * @returns true if file was created, false if already exists
   */
  createTemplate(): Promise<boolean>;
}

// ============================================================================
// Default Template
// ============================================================================

/**
 * Default template content for newly created mcps.json files.
 */
export const DEFAULT_MCP_TEMPLATE = {
  "$schema": "https://morpheus.dev/schemas/mcps.json",
  "_comment": "MCP Server Configuration for Morpheus",
  "_docs": "Add your MCP servers below. Each key is a unique server name. Required fields: transport, command. Optional: args, env.",
  "example": {
    "_comment": "EXAMPLE - Remove or replace this entry with your own MCPs",
    "transport": "stdio" as const,
    "command": "npx",
    "args": ["-y", "your-mcp-package-name"],
    "env": {}
  }
};

// ============================================================================
// Utility Functions (contracts only, implementation in mcp-loader.ts)
// ============================================================================

/**
 * Filter metadata keys from MCP config object.
 * Keys starting with '_' or '$' are considered metadata.
 */
export function isMetadataKey(key: string): boolean {
  return key.startsWith('_') || key.startsWith('$');
}
