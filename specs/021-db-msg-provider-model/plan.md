# Implementation Plan: Database Message Persistence for Provider and Model

**Branch**: `021-db-msg-provider-model` | **Date**: 2026-02-02 | **Spec**: [specs/021-db-msg-provider-model/spec.md](specs/021-db-msg-provider-model/spec.md)
**Input**: Feature specification from `specs/021-db-msg-provider-model/spec.md`

## Summary

This feature adds `provider` and `model` columns to the SQLite `messages` table to persist which LLM generated each message. It includes an automatic schema migration on startup. The `Agent` class will be updated to attach this metadata to messages before saving them.

## Technical Context

**Language/Version**: TypeScript 5.x (Node.js >= 18)
**Primary Dependencies**: `better-sqlite3`, `@langchain/core`
**Storage**: SQLite (`src/runtime/memory/sqlite.ts`)
**Testing**: Vitest
**Target Platform**: Local Daemon (Windows/Linux/macOS)
**Project Type**: Daemon/CLI
**Performance Goals**: Negligible impact on message latency. Migration must be fast (<1s).
**Constraints**: Must handle concurrent access (SQLite locks). Must support existing databases without data loss.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Local-First**: Data pertains to local SQLite DB.
- [x] **Extensibility**: Uses existing memory adapter pattern.
- [x] **Orchestration**: Adds context (Auditability) to the system.
- [x] **DX**: Automatic migration (no manual user step).
- [x] **Reliability**: includes fallback for schema checks.

## Project Structure

### Documentation (this feature)

```text
specs/021-db-msg-provider-model/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
src/
└── runtime/
    ├── agent.ts                 # Update: Attach provider/model metadata to messages
    └── memory/
        └── sqlite.ts            # Update: Add columns, migration logic, and persistence query
```

**Structure Decision**: Extending existing Memory and Agent classes. No new modules required.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (None)    |            |                                     |
