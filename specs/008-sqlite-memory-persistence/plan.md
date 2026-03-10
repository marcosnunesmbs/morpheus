# Implementation Plan: SQLite Memory Persistence for LangChain

**Branch**: `008-sqlite-memory-persistence` | **Date**: 2026-01-29 | **Spec**: [specs/008-sqlite-memory-persistence/spec.md](specs/008-sqlite-memory-persistence/spec.md)
**Input**: Feature specification from `/specs/008-sqlite-memory-persistence/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement persistent conversation history using SQLite (`better-sqlite3`). The system will automatically create and manage `~/.morpheus/memory/short-memory.db`. The `Agent` class will be refactored to use a custom `SQLiteChatMessageHistory` class instead of an in-memory array, ensuring context is preserved across CLI sessions.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js >= 18
**Primary Dependencies**: `better-sqlite3`, `@langchain/core`
**Storage**: SQLite (`better-sqlite3`)
**Testing**: `vitest`
**Target Platform**: Node.js CLI (Cross-platform)
**Project Type**: CLI Tool
**Performance Goals**: N/A for this scale (local text history)
**Constraints**: Must be local-first (file-based DB in user home)
**Scale/Scope**: Single user, sequential access

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Local-First & Privacy**: ✅ PASSED. Data remains local in `~/.morpheus`.
- **Extensibility by Design**: ✅ PASSED. Implemented as a modular class `SQLiteChatMessageHistory`.
- **Orchestration & Context**: ✅ PASSED. Enhances context by persisting it.
- **Developer Experience (DX)**: ✅ PASSED. Zero-config (auto-init).
- **Reliability & Transparency**: ✅ PASSED. Standard SQLite file, user can inspect.

## Project Structure

### Documentation (this feature)

```text
specs/008-sqlite-memory-persistence/
├── plan.md              # This file
├── research.md          # Technology selection (better-sqlite3 vs sqlite3)
├── data-model.md        # DB Schema and Class Structure
├── quickstart.md        # Manual testing steps
├── contracts/           # Interface definitions
│   └── internal-api.md  # SQLiteChatMessageHistory interface
└── tasks.md             # Implementation tasks
```

### Source Code (repository root)

```text
src/
├── runtime/
│   ├── agent.ts                   # UPDATE: Use SQLiteChatMessageHistory
│   ├── memory/                    # NEW: Memory management module
│   │   ├── sqlite.ts              # NEW: SQLiteChatMessageHistory implementation
│   │   └── __tests__/             # NEW: Tests for memory module
│   │       └── sqlite.test.ts
│   └── types.ts                   # UPDATE: Add types if needed
```

**Structure Decision**: A new `memory` submodule in `runtime` keeps persistence logic isolated from the main agent logic, following the modularity principle.

## Complexity Tracking

N/A
