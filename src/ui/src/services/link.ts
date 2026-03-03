import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import { httpClient } from './httpClient';

export type DocumentStatus = 'pending' | 'indexing' | 'indexed' | 'error';

export interface LinkDocument {
  id: string;
  filename: string;
  filepath: string;
  file_hash: string;
  file_size: number;
  mime_type: string | null;
  status: DocumentStatus;
  chunk_count: number;
  error_message: string | null;
  created_at: number;
  updated_at: number;
  indexed_at: number | null;
}

export interface LinkStats {
  totalDocuments: number;
  indexedDocuments: number;
  totalChunks: number;
  pendingDocuments: number;
  errorDocuments: number;
}

export interface DocumentListResponse {
  data: LinkDocument[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface SearchResponse {
  results: Array<{
    chunk: {
      id: string;
      document_id: string;
      chunk_index: number;
      content: string;
      char_start: number;
      char_end: number;
      created_at: number;
    };
    document: {
      id: string;
      filename: string;
      filepath: string;
    };
    score: number;
    vectorScore: number;
    bm25Score: number;
  }>;
  totalResults: number;
  query: string;
  durationMs: number;
}

export interface LinkConfig {
  provider?: string;
  model?: string;
  temperature?: number;
  api_key?: string;
  base_url?: string;
  execution_mode?: 'sync' | 'async';
  chunk_size?: number;
  score_threshold?: number;
  vector_weight?: number;
  bm25_weight?: number;
  scan_interval_ms?: number;
  max_file_size_mb?: number;
  allowed_extensions?: string[];
}

// API functions
async function fetchDocuments(url: string): Promise<DocumentListResponse> {
  const response = await httpClient.get(url);
  return response;
}

async function fetchStats(): Promise<LinkStats> {
  const response = await httpClient.get('/link/stats');
  return response;
}

async function searchDocuments(url: string, { arg }: { arg: { query: string; limit?: number } }): Promise<SearchResponse> {
  const response = await httpClient.post('/link/search', arg);
  return response;
}

async function uploadDocument(_url: string, { arg }: { arg: File }): Promise<{ success: boolean; message: string; filename: string; path: string }> {
  return httpClient.uploadFile('/link/documents/upload', arg);
}

async function deleteDocument(url: string, { arg }: { arg: string }): Promise<{ success: boolean; message: string }> {
  const response = await httpClient.delete(`/link/documents/${arg}`);
  return response;
}

async function reindexDocument(url: string, { arg }: { arg: string }): Promise<{ success: boolean; message: string }> {
  const response = await httpClient.post(`/link/reindex/${arg}`, {});
  return response;
}

async function fetchConfig(): Promise<LinkConfig> {
  const response = await httpClient.get('/config/link');
  return response;
}

async function updateConfig(url: string, { arg }: { arg: LinkConfig }): Promise<{ success: boolean; config: LinkConfig }> {
  const response = await httpClient.post('/config/link', arg);
  return response;
}

// SWR Hooks
export function useLinkDocuments(page = 1, perPage = 20, status?: string, search?: string) {
  const params = new URLSearchParams();
  params.set('page', page.toString());
  params.set('per_page', perPage.toString());
  if (status) params.set('status', status);
  if (search) params.set('search', search);

  const { data, error, isLoading, mutate } = useSWR<DocumentListResponse>(
    `/link/documents?${params.toString()}`,
    fetchDocuments,
    { refreshInterval: 5000 }
  );

  return {
    documents: data?.data ?? [],
    pagination: data,
    isLoading,
    error,
    mutate,
  };
}

export function useLinkStats() {
  const { data, error, isLoading, mutate } = useSWR<LinkStats>(
    '/link/stats',
    fetchStats,
    { refreshInterval: 5000 }
  );

  return {
    stats: data,
    isLoading,
    error,
    mutate,
  };
}

export function useLinkSearch() {
  const { trigger, data, error, isMutating } = useSWRMutation<SearchResponse, Error, string, { query: string; limit?: number }>(
    '/link/search',
    searchDocuments
  );

  return {
    search: trigger,
    results: data,
    isSearching: isMutating,
    error,
  };
}

export function useLinkConfig() {
  const { data, error, isLoading, mutate } = useSWR<LinkConfig>(
    '/config/link',
    fetchConfig
  );

  const { trigger: update, isMutating: isUpdating } = useSWRMutation<
    { success: boolean; config: LinkConfig },
    Error,
    string,
    LinkConfig
  >('/config/link', updateConfig);

  return {
    config: data,
    isLoading,
    error,
    mutate,
    update,
    isUpdating,
  };
}

// Mutation hooks
export function useUploadDocument() {
  const { trigger, data, error, isMutating } = useSWRMutation<
    { success: boolean; message: string; filename: string; path: string },
    Error,
    string,
    File
  >('/link/documents/upload', uploadDocument);

  return {
    upload: trigger,
    result: data,
    isUploading: isMutating,
    error,
  };
}

export function useDeleteDocument() {
  const { trigger, data, error, isMutating } = useSWRMutation<
    { success: boolean; message: string },
    Error,
    string,
    string
  >('/link/documents', deleteDocument);

  return {
    delete: trigger,
    result: data,
    isDeleting: isMutating,
    error,
  };
}

export function useReindexDocument() {
  const { trigger, data, error, isMutating } = useSWRMutation<
    { success: boolean; message: string },
    Error,
    string,
    string
  >('/link/reindex', reindexDocument);

  return {
    reindex: trigger,
    result: data,
    isReindexing: isMutating,
    error,
  };
}
