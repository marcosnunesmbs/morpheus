import useSWR from 'swr';

export const API_BASE = '/api';

export const fetcher = (url: string) => fetch(url).then(r => r.json());

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
  const res = await fetch(`${API_BASE}/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newConfig)
  });
  if (!res.ok) {
     const err = await res.json();
     throw new Error(err.error || 'Failed to save config');
  }
  return res.json();
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
