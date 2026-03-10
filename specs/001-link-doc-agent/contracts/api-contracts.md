# API Contracts: Link Documentation Agent

**Feature**: 001-link-doc-agent
**Date**: 2026-03-03

## HTTP API Endpoints

All endpoints are mounted under `/api/link` and require API key authentication.

### Document Management

#### GET /api/link/documents

List all documents with their status.

**Response**:
```json
{
  "documents": [
    {
      "id": "uuid-v4",
      "filename": "user-guide.pdf",
      "file_path": "/path/to/.morpheus/docs/user-guide.pdf",
      "file_size": 1048576,
      "status": "indexed",
      "chunk_count": 42,
      "created_at": "2026-03-03T10:00:00Z",
      "updated_at": "2026-03-03T10:01:00Z"
    }
  ],
  "total": 1
}
```

#### POST /api/link/documents/upload

Upload a new document.

**Request**: `multipart/form-data`
- `file`: File attachment (PDF, TXT, MD, DOCX)

**Response**:
```json
{
  "id": "uuid-v4",
  "filename": "new-doc.pdf",
  "status": "pending",
  "message": "Document uploaded and queued for indexing"
}
```

**Errors**:
- `400`: Invalid file type or file too large
- `413`: File exceeds maximum size limit

#### GET /api/link/documents/:id

Get a single document's details.

**Response**:
```json
{
  "id": "uuid-v4",
  "filename": "user-guide.pdf",
  "file_path": "/path/to/.morpheus/docs/user-guide.pdf",
  "file_size": 1048576,
  "file_hash": "sha256-hash",
  "status": "indexed",
  "chunk_count": 42,
  "error_message": null,
  "created_at": "2026-03-03T10:00:00Z",
  "updated_at": "2026-03-03T10:01:00Z"
}
```

#### DELETE /api/link/documents/:id

Delete a document and all its chunks/embeddings.

**Response**:
```json
{
  "success": true,
  "message": "Document deleted successfully"
}
```

#### POST /api/link/documents/:id/reindex

Force re-indexing of a document.

**Response**:
```json
{
  "id": "uuid-v4",
  "status": "pending",
  "message": "Document queued for re-indexing"
}
```

### Search

#### POST /api/link/search

Search documents using hybrid search.

**Request**:
```json
{
  "query": "authentication methods",
  "limit": 10,
  "threshold": 0.5
}
```

**Response**:
```json
{
  "results": [
    {
      "chunk_id": "uuid-v4",
      "content": "The system supports OAuth2 and API key authentication...",
      "document_id": "uuid-v4",
      "filename": "api-docs.md",
      "position": 5,
      "score": 0.85,
      "vector_score": 0.82,
      "bm25_score": 0.97
    }
  ],
  "total": 1,
  "query_time_ms": 150
}
```

### Configuration

#### GET /api/link/config

Get Link agent configuration.

**Response**:
```json
{
  "chunk_size": 500,
  "score_threshold": 0.5,
  "max_results": 10,
  "execution_mode": "async",
  "scan_interval_ms": 30000,
  "max_file_size_mb": 50,
  "vector_weight": 0.8,
  "bm25_weight": 0.2,
  "provider": "openai",
  "model": "text-embedding-3-small"
}
```

#### POST /api/link/config

Update Link agent configuration.

**Request**:
```json
{
  "chunk_size": 1000,
  "score_threshold": 0.7
}
```

**Response**:
```json
{
  "success": true,
  "config": {
    "chunk_size": 1000,
    "score_threshold": 0.7,
    "max_results": 10,
    "execution_mode": "async",
    "scan_interval_ms": 30000,
    "max_file_size_mb": 50,
    "vector_weight": 0.8,
    "bm25_weight": 0.2,
    "provider": "openai",
    "model": "text-embedding-3-small"
  }
}
```

### Worker Control

#### POST /api/link/worker/scan

Trigger an immediate document scan.

**Response**:
```json
{
  "success": true,
  "message": "Scan triggered",
  "documents_processed": 3,
  "documents_added": 1,
  "documents_updated": 0,
  "documents_removed": 0
}
```

#### GET /api/link/worker/status

Get worker status.

**Response**:
```json
{
  "running": true,
  "last_scan_at": "2026-03-03T10:00:00Z",
  "scan_interval_ms": 30000,
  "documents_pending": 1,
  "documents_indexing": 0,
  "documents_indexed": 10,
  "documents_error": 0
}
```

## Oracle Tool Contract

### link_search Tool

Used by Oracle to query documentation when users request information.

**Tool Name**: `link_search`

**Description**: Search user documentation for relevant information. Use this when the user asks about information that might be in their uploaded documents.

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "Natural language query to search for in documents"
    },
    "limit": {
      "type": "number",
      "description": "Maximum number of chunks to return (default: 10)",
      "default": 10
    }
  },
  "required": ["query"]
}
```

**Output**:
```json
{
  "results": [
    {
      "content": "Relevant text from document...",
      "filename": "source-document.pdf",
      "score": 0.85
    }
  ],
  "total_found": 5,
  "message": "Found 5 relevant passages"
}
```

### link_delegate Tool

Alternative tool for async execution mode.

**Tool Name**: `link_delegate`

**Description**: Delegate a documentation search task to Link agent for asynchronous processing.

**Input Schema**: Same as `link_search`

**Behavior**: Creates a background task and returns task ID. Result delivered via notification channel.

## Error Codes

| Code | Description |
|------|-------------|
| `LINK_001` | Document file not found |
| `LINK_002` | Document parsing failed |
| `LINK_003` | Embedding generation failed |
| `LINK_004` | File type not supported |
| `LINK_005` | File size exceeds limit |
| `LINK_006` | No documents indexed |
| `LINK_007` | Search query too short |

## WebSocket Events

For real-time UI updates during indexing:

### document:status

Emitted when document status changes.

```json
{
  "event": "document:status",
  "data": {
    "id": "uuid-v4",
    "filename": "doc.pdf",
    "status": "indexing",
    "progress": 50
  }
}
```

### document:indexed

Emitted when indexing completes.

```json
{
  "event": "document:indexed",
  "data": {
    "id": "uuid-v4",
    "filename": "doc.pdf",
    "chunk_count": 42,
    "duration_ms": 5000
  }
}
```