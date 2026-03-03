import type { LinkDocument, LinkChunk, SearchResult, DocumentStatus, DocumentFilters } from './repository.js';

export type { LinkDocument, LinkChunk, SearchResult, DocumentStatus, DocumentFilters };

export interface LinkSearchOptions {
  query: string;
  limit?: number;
  scoreThreshold?: number;
  vectorWeight?: number;
  bm25Weight?: number;
}

export interface LinkSearchResponse {
  results: SearchResult[];
  totalResults: number;
  query: string;
  durationMs: number;
}

export interface LinkIndexProgress {
  documentId: string;
  filename: string;
  status: DocumentStatus;
  chunksProcessed: number;
  totalChunks: number;
}
