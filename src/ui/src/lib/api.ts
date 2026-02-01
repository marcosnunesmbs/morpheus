import useSWR from 'swr';
import { httpClient } from '../services/httpClient';

export const API_BASE = '/api';

export const fetcher = (url: string) => {
  // httpClient adds /api, so we strip it if present to avoid /api/api/...
  const path = url.startsWith(API_BASE) ? url.substring(API_BASE.length) : url;
  return httpClient.get<any>(path);
};

export interface ServerStatus {
  status: string;
  uptimeSeconds: number;
  pid: number;
  projectVersion: string;
  nodeVersion: string;
  agentName: string;
  llmProvider?: string;
  llmModel?: string;
}

export function useStatus() {
  return useSWR<ServerStatus>(`${API_BASE}/status`, fetcher, { refreshInterval: 5000 });
}

export function useConfig() {
  return useSWR<any>(`${API_BASE}/config`, fetcher);
}

export async function saveConfig(newConfig: any) {
  return httpClient.post('/config', newConfig);
}

export interface LogFile {
  name: string;
  size: number;
  modified: string;
}

export function useLogs() {
  return useSWR<LogFile[]>(`${API_BASE}/logs`, fetcher);
}

export function useLogContent(filename: string | null) {
  return useSWR<{ lines: string[] }>(filename ? `${API_BASE}/logs/${filename}?limit=1000` : null, fetcher, { refreshInterval: 2000 });
}
