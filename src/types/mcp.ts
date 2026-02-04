export type MCPServerConfig =
  | {
      transport: 'stdio';
      command: string;
      args?: string[];
      env?: Record<string, string>;
      _comment?: string;
    }
  | {
      transport: 'http';
      url: string;
      headers?: Record<string, string>;
      args?: string[];
      env?: Record<string, string>;
      _comment?: string;
    };

export type MCPServersConfig = Record<string, MCPServerConfig>;

export interface MCPConfigFile {
  $schema?: string;
  _comment?: string;
  _docs?: string;
  [key: string]: MCPServerConfig | string | undefined;
}

export const DEFAULT_MCP_TEMPLATE = {
  "_comment": "MCP Server Configuration for Morpheus",
  "_docs": "Add your MCP servers below. Each key is a unique server name.",
  "example": {
    "_comment": "EXAMPLE - Remove or replace this entry with your own MCPs",
    "transport": "stdio",
    "command": "npx",
    "args": ["-y", "your-mcp-package-name"],
    "env": {}
  }
};
