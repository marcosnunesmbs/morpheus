# Quickstart: Link Documentation Agent

**Feature**: 001-link-doc-agent
**Date**: 2026-03-03

## Overview

Link is a documentation specialist agent that enables RAG (Retrieval-Augmented Generation) over your personal documents. It automatically indexes files placed in `.morpheus/docs/` and provides hybrid search capabilities to Oracle for answering document-related queries.

## Quick Setup

### 1. Install Dependencies

```bash
npm install pdf-parse mammoth --legacy-peer-deps
```

### 2. Create Docs Folder

The folder `~/.morpheus/docs/` is created automatically on first startup, or you can create it manually:

```bash
mkdir -p ~/.morpheus/docs
```

### 3. Add Documents

Place documents in the docs folder:

```bash
cp ~/Documents/my-guide.pdf ~/.morpheus/docs/
```

Supported formats:
- PDF (`.pdf`)
- Markdown (`.md`)
- Plain text (`.txt`)
- Word documents (`.docx`)

### 4. Configure Link (Optional)

Add to `~/.morpheus/zaion.yaml`:

```yaml
link:
  chunk_size: 500
  score_threshold: 0.5
  max_results: 10
  execution_mode: async
  scan_interval_ms: 30000
  max_file_size_mb: 50
  vector_weight: 0.8
  bm25_weight: 0.2
```

## Usage

### Via Chat (Oracle)

Ask Oracle about your documents:

```
User: What does my documentation say about authentication?
Oracle: [Uses link_search tool] Based on your API documentation...
```

### Via API

```bash
# List documents
curl -H "X-API-Key: your-key" http://localhost:7777/api/link/documents

# Upload document
curl -H "X-API-Key: your-key" -F "file=@doc.pdf" http://localhost:7777/api/link/documents/upload

# Search
curl -H "X-API-Key: your-key" -H "Content-Type: application/json" \
  -d '{"query":"authentication methods"}' \
  http://localhost:7777/api/link/search
```

### Via UI

Navigate to `/documents` in the dashboard to:
- View all indexed documents
- Upload new documents
- Delete documents
- See indexing status

## Database Location

- Documents/Chunks/Embeddings: `~/.morpheus/memory/link.db`
- Original files: `~/.morpheus/docs/`

## Environment Variables

```bash
MORPHEUS_LINK_CHUNK_SIZE=500
MORPHEUS_LINK_SCORE_THRESHOLD=0.5
MORPHEUS_LINK_EXECUTION_MODE=async
MORPHEUS_LINK_SCAN_INTERVAL_MS=30000
```