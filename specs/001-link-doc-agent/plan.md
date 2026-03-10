# Implementation Plan: Link Documentation Agent

**Branch**: `001-link-doc-agent` | **Date**: 2026-03-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-link-doc-agent/spec.md`

## Summary

Link is a documentation specialist subagent that enables RAG (Retrieval-Augmented Generation) over user documents. It monitors `.morpheus/docs` for files, chunks them, creates vector embeddings, and provides hybrid search (80% vector + 20% BM25) for Oracle to answer user queries about their documentation.

## Technical Context

**Language/Version**: TypeScript 5.x (ESM, target ES2022, module NodeNext)
**Primary Dependencies**: LangChain (agent orchestration), better-sqlite3 (storage), sqlite-vec (embeddings), pdf-parse, mammoth (DOCX)
**Storage**: SQLite (`~/.morpheus/memory/link.db` for documents/chunks/embeddings) - separate from short-memory.db
**Testing**: Vitest (existing test framework)
**Target Platform**: Node.js >= 18 (local daemon)
**Project Type**: Backend subagent + frontend UI page
**Performance Goals**: Search queries < 3s for 10k chunks; document indexing < 60s for 1MB files
**Constraints**: Must follow existing subagent pattern; integrate with audit system; support verbose mode notifications
**Scale/Scope**: Up to 10,000 chunks per user; documents up to 50MB; unlimited documents

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Local-First & Privacy | ✅ PASS | All document storage and embeddings are local in `~/.morpheus/` |
| II. Extensibility by Design | ✅ PASS | Link is a subagent extension following established pattern |
| III. Orchestration & Context | ✅ PASS | Provides document context to Oracle for informed responses |
| IV. Developer Experience | ✅ PASS | Configuration via zaion.yaml + UI; declarative settings |
| V. Reliability & Transparency | ✅ PASS | Audit trail for all searches; verbose mode notifications |

**Quality Gates**:
- [ ] Unit tests for chunking, hashing, search logic
- [ ] Linting passes
- [ ] Documentation in CLAUDE.md for new subagent pattern
- [ ] User-facing docs for UI page

## Project Structure

### Documentation (this feature)

```text
specs/001-link-doc-agent/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── runtime/
│   ├── link.ts                    # Link subagent (singleton, execute, createDelegateTool)
│   ├── link-worker.ts             # Document scanning worker
│   ├── link-repository.ts         # SQLite repository for documents/chunks
│   ├── link-chunker.ts            # Document chunking logic
│   └── link-search.ts             # Hybrid search (vector + BM25)
├── config/
│   └── schemas.ts                 # Add LinkConfigSchema BEFORE ConfigSchema
├── types/
│   └── config.ts                  # Add LinkConfig interface
├── runtime/
│   ├── audit/
│   │   └── types.ts               # Add 'link' to AuditAgent union
│   └── tasks/
│       └── types.ts               # Add 'link' to TaskAgent union
├── http/
│   ├── api.ts                     # Mount link router
│   └── routers/
│       └── link.ts                # Document CRUD, upload, search endpoints
├── cli/commands/
│   ├── start.ts                   # Initialize LinkWorker, LinkRepository
│   └── restart.ts                 # Same as start.ts
└── ui/src/
    ├── pages/
    │   └── Documents.tsx          # Document management page
    ├── services/
    │   └── link.ts                # SWR hooks for documents API
    └── components/
        └── link/
            ├── DocumentTable.tsx  # Document list with status
            ├── UploadButton.tsx   # File upload component
            └── StatusBadge.tsx    # Indexing status indicator

tests/
├── unit/
│   ├── link-chunker.test.ts       # Chunking logic tests
│   ├── link-search.test.ts        # Hybrid search tests
│   └── link-repository.test.ts    # Repository CRUD tests
└── integration/
    └── link-worker.test.ts        # Worker sync tests
```

**Structure Decision**: Single project structure following existing Morpheus patterns. Link integrates as a new subagent alongside Apoc, Neo, Trinity, following the singleton pattern defined in CLAUDE.md.

## Complexity Tracking

No constitution violations. Feature follows established patterns.

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| Separate DB file | `link.db` | Isolates document data from session/memory data; easier to backup/clear independently |
| No new MCP required | Uses existing sqlite-vec | Reuses Sati's embedding infrastructure |
| Worker pattern | Follows ChronosWorker | Proven pattern for background processing |