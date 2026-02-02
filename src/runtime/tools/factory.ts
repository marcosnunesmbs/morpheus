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

  display.log('Tool loaded: - '+ tool.name, { source: 'ToolsFactory' });
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

export class ToolsFactory {
  static async create(): Promise<StructuredTool[]> { // LangChain Tools type
    const display = DisplayManager.getInstance();

    const mcpServers = await loadMCPConfig();
    const serverCount = Object.keys(mcpServers).length;

    if (serverCount === 0) {
        display.log('No MCP servers configured in mcps.json', { level: 'info', source: 'ToolsFactory' });
        return [];
    }

    const client = new MultiServerMCPClient({
      mcpServers: mcpServers as any,
      onConnectionError: "ignore",
      // log the MCP client's internal events
      // beforeToolCall: ({ serverName, name, args }) => {
      //   display.log(`MCP Tool Call - Server: ${serverName}, Tool: ${name}, Args: ${JSON.stringify(args)}`, { source: 'MCPServer' });
      //   return;
      // },
      // // log the results of tool calls
      // afterToolCall: (res) => {
      //   display.log(`MCP Tool Result - ${JSON.stringify(res)}`, { source: 'MCPServer' });
      //   return;
      // }
    });

    try {
      const tools = await client.getTools();
      
      // Sanitize tool schemas to remove fields not supported by Gemini
      const sanitizedTools = tools.map(tool => wrapToolWithSanitizedSchema(tool));
      
      display.log(`Loaded ${sanitizedTools.length} MCP tools (schemas sanitized for Gemini compatibility)`, { level: 'info', source: 'ToolsFactory' });
      
      return sanitizedTools;
    } catch (error) {
      display.log(`Failed to initialize MCP tools: ${error}`, { level: 'warning', source: 'ToolsFactory' });
      return []; // Return empty tools on failure to allow agent to start
    }
  }
}
