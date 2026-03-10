# Research: Link Documentation Agent

**Feature**: 001-link-doc-agent
**Date**: 2026-03-03

## Research Tasks

### 1. Document Parsing Libraries

**Decision**: Use `pdf-parse` for PDF, `mammoth` for DOCX, native fs for TXT/MD

**Rationale**:
- `pdf-parse` is pure JavaScript, no external dependencies, works well for text-heavy PDFs
- `mammoth` converts DOCX to clean HTML/text, well-maintained
- TXT and MD are plain text, read directly with fs

**Alternatives Considered**:
- `pdfjs-dist` (Mozilla's PDF.js): More powerful but heavier, better for PDF rendering
- `docx-parser`: Simpler but less maintained than mammoth
- `unified`/`remark` for MD: Overkill for simple text extraction; we can parse MD as plain text for chunking

### 2. BM25 Implementation

**Decision**: Implement custom BM25 scoring using sqlite-vec FTS5 extension

**Rationale**:
- SQLite FTS5 supports BM25 ranking natively via `bm25()` function
- Keeps everything in one database without external dependencies
- Consistent with existing Morpheus architecture (SQLite-first)

**Alternatives Considered**:
- `flexsearch`: Pure JS full-text search, but requires in-memory index
- `lunr`: Another JS search library, but syncs poorly with SQLite
- `orama`: Modern but overkill for our needs

### 3. Hybrid Search Weighting

**Decision**: 80% vector + 20% BM25 with configurable threshold

**Rationale**:
- Vector search captures semantic meaning better
- BM25 provides exact keyword matching for specific terms (product names, codes, IDs)
- 80/20 split is a common RAG pattern that balances both approaches
- User-configurable threshold allows tuning for different use cases

**Implementation**:
```
final_score = (vector_score * 0.8) + (bm25_score * 0.2)
```

Score normalization:
- Vector scores: Cosine similarity (0 to 1)
- BM25 scores: Normalize to 0-1 range using min-max scaling per query

### 4. Chunking Strategy

**Decision**: Fixed character count with sentence boundary respect

**Rationale**:
- Default 500 characters is a good balance for most embedding models
- Respecting sentence boundaries prevents mid-sentence cuts that lose context
- Configurable size allows users to tune for their content

**Implementation**:
1. Split text into paragraphs
2. For each paragraph, if longer than chunk_size, split by sentences
3. Merge short chunks (< 100 chars) with next chunk
4. Track chunk position for ordering and citation

**Alternatives Considered**:
- Token-based chunking: Requires tokenizer dependency, less predictable size
- Recursive character splitting: More complex, similar results
- Semantic chunking (by topic): Requires additional NLP, overkill

### 5. Hash Algorithm for Change Detection

**Decision**: SHA-256 content hash

**Rationale**:
- Node.js crypto module provides native SHA-256
- Fast enough for documents up to 50MB
- Cryptographic strength not needed but no downside

**Implementation**:
```typescript
import { createHash } from 'crypto';
const hash = createHash('sha256').update(fileContent).digest('hex');
```

### 6. Embedding Strategy

**Decision**: Reuse Sati's embedding infrastructure

**Rationale**:
- Sati already has sqlite-vec setup with embedding generation
- Same embedding provider ensures consistency
- Reduces code duplication

**Implementation**:
- Share embedding function from `src/runtime/memory/sati/embeddings.ts`
- Store vectors in separate `link.db` but use same embedding logic

### 7. Worker Scan Interval

**Decision**: Configurable with 30-second default

**Rationale**:
- 30 seconds is responsive enough for most use cases
- Not too aggressive to cause performance issues
- Configurable for users with different needs (real-time vs batch)

### 8. File Size Limits

**Decision**: 50MB maximum file size

**Rationale**:
- Prevents memory exhaustion during parsing
- Most documentation files are under 10MB
- Can be made configurable if needed

## Resolved Technical Decisions

| Decision Point | Choice | Reason |
|----------------|--------|--------|
| PDF parsing | pdf-parse | Pure JS, no deps |
| DOCX parsing | mammoth | Well-maintained |
| BM25 | SQLite FTS5 | Native, no external deps |
| Search weighting | 80/20 vector/BM25 | Common RAG pattern |
| Chunking | 500 chars, sentence-aware | Balanced for embeddings |
| Hashing | SHA-256 | Native, fast |
| Embeddings | Reuse Sati infrastructure | Consistency |
| Scan interval | 30s default | Responsive but not aggressive |
| Max file size | 50MB | Prevent memory issues |

## Dependencies to Add

```json
{
  "pdf-parse": "^1.1.1",
  "mammoth": "^1.6.0"
}
```

Both are pure JavaScript with no native compilation required.