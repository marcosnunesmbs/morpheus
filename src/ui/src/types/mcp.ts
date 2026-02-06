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

export type MCPServerRecord = {
  name: string;
  enabled: boolean;
  config: MCPServerConfig;
};

export type MCPListResponse = {
  servers: MCPServerRecord[];
};
