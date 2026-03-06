import useSWR from 'swr';
import { httpClient } from './httpClient';

// Types
export interface LinkDocument {
  id: string;
  filename: string;
  file_path: string;
  file_hash: string;
  file_size: number;
  status: 'pending' | 'indexing' | 'indexed' | 'error';
  error_message: string | null;
  chunk_count: number;
  created_at: string;
  updated_at: string;
}

export interface LinkStats {
  documents_total: number;
  documents_indexed: number;
  chunks_total: number;
}

export interface LinkConfig {
  chunk_size: number;
  score_threshold: number;
  max_results: number;
  execution_mode: 'sync' | 'async';
  scan_interval_ms: number;
  max_file_size_mb: number;
  vector_weight: number;
  bm25_weight: number;
}

// SWR fetcher
const fetcher = <T>(url: string): Promise<T> => httpClient.get<T>(url);

// SWR Hooks

export function useLinkDocuments(status?: string) {
  const url = status ? `/link/documents?status=${status}` : '/link/documents';
  const { data, error, mutate } = useSWR<{ documents: LinkDocument[]; stats: LinkStats }>(
    url,
    fetcher
  );
  return {
    documents: data?.documents ?? [],
    stats: data?.stats,
    isLoading: !error && !data,
    error,
    mutate,
  };
}

export function useLinkDocument(id: string | null) {
  const { data, error } = useSWR<{ document: LinkDocument; chunks: unknown[] }>(
    id ? `/link/documents/${id}` : null,
    fetcher
  );
  return {
    document: data?.document,
    chunks: data?.chunks ?? [],
    isLoading: !error && !data,
    error,
  };
}

export function useLinkConfig() {
  const { data, error, mutate } = useSWR<LinkConfig>('/link/config', fetcher);
  return {
    config: data,
    isLoading: !error && !data,
    error,
    mutate,
  };
}

export function useLinkWorkerStatus() {
  const { data, error, mutate } = useSWR<{
    running: boolean;
    scan_interval_ms: number;
    documents_total: number;
    documents_indexed: number;
    chunks_total: number;
  }>('/link/worker/status', fetcher);
  return {
    status: data,
    isLoading: !error && !data,
    error,
    mutate,
  };
}

// API Actions

export async function uploadDocument(
  file: File,
  onProgress?: (percent: number) => void
): Promise<{ message: string; filename: string; indexed: number }> {
  if (onProgress) {
    return httpClient.uploadFileWithProgress<{ message: string; filename: string; indexed: number }>(
      '/link/documents/upload', file, onProgress
    );
  }
  return httpClient.uploadFile<{ message: string; filename: string; indexed: number }>('/link/documents/upload', file);
}

export async function deleteDocument(id: string): Promise<void> {
  await httpClient.delete<void>(`/link/documents/${id}`);
}

export async function reindexDocument(id: string): Promise<{ message: string; result: string }> {
  return httpClient.post<{ message: string; result: string }>(`/link/documents/${id}/reindex`, {});
}

export async function triggerScan(): Promise<{ indexed: number; removed: number; errors: number }> {
  const result = await httpClient.post<{ indexed?: number; removed?: number; errors?: number }>('/link/worker/scan', {});
  return {
    indexed: result.indexed ?? 0,
    removed: result.removed ?? 0,
    errors: result.errors ?? 0,
  };
}

export async function updateLinkConfig(config: Partial<LinkConfig>): Promise<{ message: string; config: LinkConfig }> {
  return httpClient.post<{ message: string; config: LinkConfig }>('/link/config', config);
}
