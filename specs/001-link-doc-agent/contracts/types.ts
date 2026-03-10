/**
 * Link Documentation Agent - TypeScript Contracts
 * Feature: 001-link-doc-agent
 * Date: 2026-03-03
 *
 * These interfaces define the contracts between components.
 * Implementation files should import from this file for type safety.
 */

// =============================================================================
// Document Types
// =============================================================================

/**
 * Document processing status
 */
export type DocumentStatus = 'pending' | 'indexing' | 'indexed' | 'error';

/**
 * Document record in database
 */
export interface Document {
  id: string;
  filename: string;
  file_path: string;
  file_hash: string;
  file_size: number;
  status: DocumentStatus;
  error_message: string | null;
  chunk_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Document chunk with position and content
 */
export interface Chunk {
  id: string;
  document_id: string;
  position: number;
  content: string;
  char_start: number;
  char_end: number;
  created_at: string;
}

/**
 * Embedding vector for a chunk
 */
export interface Embedding {
  chunk_id: string;
  vector: number[];
  created_at: string;
}

// =============================================================================
// Search Types
// =============================================================================

/**
 * Search result with combined scores
 */
export interface SearchResult {
  chunk_id: string;
  content: string;
  document_id: string;
  filename: string;
  position: number;
  score: number;          // Combined final score
  vector_score: number;   // Vector similarity score
  bm25_score: number;     // BM25 text search score
}

/**
 * Search request parameters
 */
export interface SearchRequest {
  query: string;
  limit?: number;
  threshold?: number;
}

/**
 * Search response
 */
export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query_time_ms: number;
}

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Link agent configuration
 * Extends base LLM config with Link-specific settings
 */
export interface LinkConfig {
  // LLM settings (inherited from LLMConfig)
  provider?: string;
  model?: string;
  temperature?: number;
  api_key?: string;

  // Chunking
  chunk_size: number;           // Default: 500

  // Search
  score_threshold: number;      // Default: 0.5
  max_results: number;          // Default: 10

  // Execution
  execution_mode: 'sync' | 'async';  // Default: 'async'

  // Worker
  scan_interval_ms: number;     // Default: 30000
  max_file_size_mb: number;     // Default: 50

  // Search weights
  vector_weight: number;        // Default: 0.8
  bm25_weight: number;          // Default: 0.2
}

/**
 * Default Link configuration
 */
export const DEFAULT_LINK_CONFIG: LinkConfig = {
  chunk_size: 500,
  score_threshold: 0.5,
  max_results: 10,
  execution_mode: 'async',
  scan_interval_ms: 30000,
  max_file_size_mb: 50,
  vector_weight: 0.8,
  bm25_weight: 0.2,
};

// =============================================================================
// Agent Types
// =============================================================================

/**
 * Link agent execution result
 */
export interface LinkResult {
  content: string;
  results: SearchResult[];
  total_found: number;
  duration_ms: number;
}

/**
 * Task context passed to Link when executed as a task
 */
export interface LinkTaskContext {
  origin_channel: string;
  session_id: string;
  origin_message_id?: string;
  origin_user_id?: string;
}

// =============================================================================
// Worker Types
// =============================================================================

/**
 * Worker scan result summary
 */
export interface ScanResult {
  documents_processed: number;
  documents_added: number;
  documents_updated: number;
  documents_removed: number;
  errors: Array<{
    document_id: string;
    filename: string;
    error: string;
  }>;
}

/**
 * Worker status
 */
export interface WorkerStatus {
  running: boolean;
  last_scan_at: string | null;
  scan_interval_ms: number;
  documents_pending: number;
  documents_indexing: number;
  documents_indexed: number;
  documents_error: number;
}

// =============================================================================
// API Types (for HTTP endpoints)
// =============================================================================

/**
 * Document upload response
 */
export interface DocumentUploadResponse {
  id: string;
  filename: string;
  status: DocumentStatus;
  message: string;
}

/**
 * Document list response
 */
export interface DocumentListResponse {
  documents: Document[];
  total: number;
}

/**
 * API error response
 */
export interface LinkApiError {
  code: string;
  message: string;
  details?: unknown;
}

// =============================================================================
// Audit Types
// =============================================================================

/**
 * Link audit event data
 */
export interface LinkAuditData {
  query: string;
  results_count: number;
  top_score: number;
  duration_ms: number;
  threshold: number;
  execution_mode: 'sync' | 'async';
}