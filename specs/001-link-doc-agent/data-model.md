# Data Model: Link Documentation Agent

**Feature**: 001-link-doc-agent
**Date**: 2026-03-03

## Entity Overview

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│  Document   │ 1───n │   Chunk     │ 1───1 │  Embedding  │
│             │       │             │       │             │
│ id          │       │ id          │       │ chunk_id    │
│ filename    │       │ document_id │       │ vector      │
│ file_path   │       │ position    │       │ created_at  │
│ file_hash   │       │ content     │       └─────────────┘
│ file_size   │       │ char_start  │
│ status      │       │ char_end    │
│ chunk_count │       │ created_at  │
│ created_at  │       └─────────────┘
│ updated_at  │
└─────────────┘
```

## Tables

### documents

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| filename | TEXT | NOT NULL | Original filename |
| file_path | TEXT | NOT NULL UNIQUE | Full path in docs folder |
| file_hash | TEXT | NOT NULL | SHA-256 content hash |
| file_size | INTEGER | NOT NULL | Size in bytes |
| status | TEXT | NOT NULL DEFAULT 'pending' | pending, indexing, indexed, error |
| error_message | TEXT | NULL | Error details if status = error |
| chunk_count | INTEGER | DEFAULT 0 | Number of chunks created |
| created_at | TEXT | NOT NULL | ISO timestamp |
| updated_at | TEXT | NOT NULL | ISO timestamp |

**Status Transitions**:
- `pending` → `indexing` (worker picks up document)
- `indexing` → `indexed` (successful completion)
- `indexing` → `error` (processing failure)
- `indexed` → `pending` (hash change detected, re-index)
- `error` → `pending` (retry triggered)

**Indexes**:
- `idx_documents_status` on (status)
- `idx_documents_hash` on (file_hash)

### chunks

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| document_id | TEXT | NOT NULL | Foreign key to documents |
| position | INTEGER | NOT NULL | Chunk order (0-indexed) |
| content | TEXT | NOT NULL | Chunk text content |
| char_start | INTEGER | NOT NULL | Start character position in document |
| char_end | INTEGER | NOT NULL | End character position in document |
| created_at | TEXT | NOT NULL | ISO timestamp |

**Constraints**:
- `UNIQUE(document_id, position)` - One chunk per position per document
- `FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE`

**Indexes**:
- `idx_chunks_document` on (document_id)
- `idx_chunks_fts` - FTS5 virtual table for full-text search

### embeddings

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| chunk_id | TEXT | PRIMARY KEY | Foreign key to chunks |
| vector | BLOB | NOT NULL | sqlite-vec vector blob |
| created_at | TEXT | NOT NULL | ISO timestamp |

**Constraints**:
- `FOREIGN KEY (chunk_id) REFERENCES chunks(id) ON DELETE CASCADE`

**Vector Search**:
- Uses sqlite-vec extension for vector similarity
- Dimension matches embedding model (typically 384 or 768)

## FTS5 Virtual Table

```sql
CREATE VIRTUAL TABLE chunks_fts USING fts5(
  content,
  content='chunks',
  content_rowid='rowid',
  tokenize='porter unicode61'
);
```

## Configuration Schema

### LinkConfig

```typescript
interface LinkConfig extends LLMConfig {
  // Chunking
  chunk_size: number;           // Default: 500 (characters)

  // Search
  score_threshold: number;      // Default: 0.5 (0.0 - 1.0)
  max_results: number;          // Default: 10

  // Execution
  execution_mode: 'sync' | 'async';  // Default: 'async'

  // Worker
  scan_interval_ms: number;     // Default: 30000 (30 seconds)
  max_file_size_mb: number;     // Default: 50

  // Search weights
  vector_weight: number;        // Default: 0.8
  bm25_weight: number;          // Default: 0.2
}
```

## Database File

**Path**: `~/.morpheus/memory/link.db`

**Rationale for separate DB**:
1. Documents can be cleared independently of chat history
2. Different backup/export needs
3. Smaller short-memory.db for core session data
4. Easier to implement document archival/export

## Migration Strategy

Use existing `migrateTable()` pattern from `src/runtime/memory/sqlite.ts`:

1. Check if `documents` table exists
2. If not, create all tables
3. Add new columns incrementally as feature evolves

## Data Lifecycle

1. **Document Added**:
   - Create document record with status='pending'
   - Worker picks up, sets status='indexing'
   - Parse document, create chunks
   - Generate embeddings for each chunk
   - Set status='indexed', update chunk_count

2. **Document Modified**:
   - Hash mismatch detected on scan
   - Delete existing chunks/embeddings
   - Set status='pending'
   - Re-index as new document

3. **Document Deleted**:
   - File not found on scan
   - CASCADE delete removes chunks and embeddings
   - Document record deleted

## Query Patterns

### Hybrid Search Query

```sql
-- Vector similarity (pseudo-code, actual uses sqlite-vec functions)
SELECT c.id, c.content, c.document_id, d.filename,
       vec_distance_cosine(e.vector, :query_vector) as vector_score
FROM chunks c
JOIN embeddings e ON c.id = e.chunk_id
JOIN documents d ON c.document_id = d.id
WHERE d.status = 'indexed'
ORDER BY vector_score DESC
LIMIT :limit;

-- BM25 full-text search
SELECT c.id, c.content, c.document_id, d.filename,
       bm25(chunks_fts) as bm25_score
FROM chunks c
JOIN chunks_fts fts ON c.rowid = fts.rowid
JOIN documents d ON c.document_id = d.id
WHERE d.status = 'indexed'
  AND chunks_fts MATCH :query
ORDER BY bm25_score DESC
LIMIT :limit;
```

### Document Status Query

```sql
SELECT id, filename, status, chunk_count, file_size, updated_at
FROM documents
ORDER BY updated_at DESC;
```