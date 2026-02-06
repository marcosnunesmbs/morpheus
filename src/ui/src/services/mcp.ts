import { HttpClient } from './httpClient';
import type { MCPListResponse, MCPServerConfig } from '../types/mcp';

const httpClient = HttpClient.getInstance();

export const mcpService = {
  fetchServers: async (): Promise<MCPListResponse> => httpClient.get<MCPListResponse>('/mcp/servers'),
  addServer: async (name: string, config: MCPServerConfig): Promise<void> =>
    httpClient.post('/mcp/servers', { name, config }),
  updateServer: async (name: string, config: MCPServerConfig): Promise<void> =>
    httpClient.put(`/mcp/servers/${encodeURIComponent(name)}`, { config }),
  deleteServer: async (name: string): Promise<void> =>
    httpClient.delete(`/mcp/servers/${encodeURIComponent(name)}`),
  toggleServer: async (name: string, enabled: boolean): Promise<void> =>
    httpClient.patch(`/mcp/servers/${encodeURIComponent(name)}/toggle`, { enabled }),
};
