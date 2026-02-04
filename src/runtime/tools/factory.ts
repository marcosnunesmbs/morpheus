import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { DisplayManager } from "../display.js";
import { StructuredTool } from "@langchain/core/tools";
import { loadMCPConfig } from "../../config/mcp-loader.js";

const display = DisplayManager.getInstance();

// Fields not supported by Google Gemini API
const UNSUPPORTED_SCHEMA_FIELDS = ['examples', 'additionalInfo', 'default', '$schema'];

/**
 * Recursively removes unsupported fields from JSON schema objects.
 * This is needed because some MCP servers (like Coolify) return schemas
 * with fields that Gemini doesn't accept.
 */
function sanitizeSchema(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeSchema);
  }

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
 * Creates a proxy that intercepts schema access and sanitizes the output.
 */
function wrapToolWithSanitizedSchema(tool: StructuredTool): StructuredTool {

  // display.log('Tool loaded: - '+ tool.name, { source: 'Construtor' });
  // The MCP tools have a schema property that returns JSON Schema
  // We need to intercept and sanitize it
  const originalSchema = (tool as any).schema;
  
  if (originalSchema && typeof originalSchema === 'object') {
    // Sanitize the schema object directly
    const sanitized = sanitizeSchema(originalSchema);
    (tool as any).schema = sanitized;
  }
  
  return tool;
}

export class Construtor {
  static async create(): Promise<StructuredTool[]> { // LangChain Tools type
    const display = DisplayManager.getInstance();

    const mcpServers = await loadMCPConfig();
    const serverCount = Object.keys(mcpServers).length;

    // console.log(mcpServers);

    if (serverCount === 0) {
      display.log('No MCP servers configured in mcps.json', { level: 'info', source: 'Construtor' });
      return [];
    }

    const allTools: StructuredTool[] = [];

    // Create a client for each server to handle tool naming conflicts
    for (const [serverName, serverConfig] of Object.entries(mcpServers)) {
      const client = new MultiServerMCPClient({
        mcpServers: {
          [serverName]: serverConfig
        } as any,
        onConnectionError: "ignore",
      });

      try {
        const tools = await client.getTools();
        
        // Rename tools to include server prefix to avoid collisions
        tools.forEach(tool => {
          const originalName = tool.name;
          const newName = `${serverName}_${originalName}`;
          Object.defineProperty(tool, "name", { value: newName });
          
          const shortDesc = tool.description && typeof tool.description === 'string' ? tool.description.slice(0, 100) + '...' : '';
          display.log(`\nLoaded MCP tool: ${tool.name} (from ${serverName})\n ${shortDesc}`, { level: 'info', source: 'Construtor' });
        });
        
        // Sanitize tool schemas to remove fields not supported by Gemini
        const sanitizedTools = tools.map(tool => wrapToolWithSanitizedSchema(tool));
        
        allTools.push(...sanitizedTools);
      } catch (error) {
        display.log(`Failed to initialize MCP tools for server '${serverName}': ${error}`, { level: 'warning', source: 'Construtor' });
        // Continue to other servers even if one fails
      }
    }
      
    display.log(`Loaded ${allTools.length} total MCP tools (schemas sanitized for Gemini compatibility)`, { level: 'info', source: 'Construtor' });
      
    return allTools;
  }
}
