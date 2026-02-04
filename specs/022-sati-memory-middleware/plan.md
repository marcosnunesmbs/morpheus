# Implementation Plan: Sati Memory Middleware

**Branch**: `022-sati-memory-middleware` | **Date**: 2026-02-04 | **Spec**: [specs/022-sati-memory-middleware/spec.md](specs/022-sati-memory-middleware/spec.md)
**Input**: Feature specification from `/specs/022-sati-memory-middleware/spec.md`

## Summary

Implement a custom LangChain middleware (`SatiMemoryMiddleware`) that intercepts agent execution to provide long-term memory capabilities.
- **Before execution**: Retrieves relevant memories from a dedicated SQLite DB (`santi-memory.db`) using semantic/keyword matching and injects them as a SystemMessage.
- **After execution**: Analyzes the conversation using a specialized sub-agent ("Sati") to extract persistent facts/preferences, deduplicates them, and stores them in the DB.
- **Infrastructure**: Uses `better-sqlite3` for local storage and reuses the main "Zion" LLM configuration for the sub-agent.

## Technical Context

**Language/Version**: TypeScript 5.x (Node.js >= 18)
**Primary Dependencies**: `langchain` (Middleware), `@langchain/core` (Messages), `better-sqlite3` (Storage), `zod` (Validation)
**Storage**: SQLite (`.morpheus/memory/santi-memory.db`)
**Testing**: `vitest` (Unit tests for middleware and service)
**Target Platform**: Local execution (CLI/Daemon)
**Project Type**: Feature Logic (Middleware + Service)
**Performance Goals**: <500ms overhead for retrieval; persistence can be async/background.
**Constraints**: strictly local storage; no new external dependencies; reuse existing LLM config.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Local-First**: Uses local SQLite database. No data sent to cloud memory stores.
- [x] **Extensibility**: Implemented as Middleware, adhering to extension principles.
- [x] **Orchestration**: Adds "system awareness" via memory context.
- [x] **DX**: Auto-initialization of DB files on start and during `init`.
- [x] **Reliability**: Structured logging of memory decisions.

## Project Structure

### Documentation (this feature)

```text
specs/022-sati-memory-middleware/
├── plan.md              # This file
├── research.md          # Technical decisions
├── data-model.md        # Database schema
├── quickstart.md        # Usage guide
├── implementation.md    # Implementation report
├── contracts/           # TypeScript interfaces
└── tasks.md             # Implementation tasks
```

### Source Code

```text
src/
├── runtime/
│   ├── memory/
│   │   ├── sati/
│   │   │   ├── index.ts           # Middleware entry point
│   │   │   ├── service.ts         # SatiService (Logic/LLM)
│   │   │   ├── repository.ts      # SQLite logic
│   │   │   ├── system-prompts.ts  # Prompts for Sati agent
│   │   │   └── types.ts           # Internal types
│   │   └── index.ts               # Export middleware
└── config/
    └── schemas.ts                 # (No changes needed if reusing existing config)
```

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| New SQLite DB | Separation of concerns (Short vs Long term) | Using single DB risks session cleanup wiping long-term data; strict requirement. |
