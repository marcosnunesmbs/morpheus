# Implementation Plan: Refactor Tools Factory & Memory Config

**Branch**: `014-tools-factory-memory-limit` | **Date**: 2026-01-31 | **Spec**: [specs/014-tools-factory-memory-limit/spec.md](specs/014-tools-factory-memory-limit/spec.md)
**Input**: Feature specification from `/specs/014-tools-factory-memory-limit/spec.md`

## Summary

This feature introduces a configurable message history limit (`memory_limit`) to control context window usage and refactors the MCP tool creation logic out of `ProviderFactory` into a dedicated `ToolsFactory` to improve modularity and maintainability.

## Technical Context

**Language/Version**: TypeScript 5.x (Node.js >= 18)
**Primary Dependencies**: `langchain`, `@langchain/mcp-adapters`, `zod`, `better-sqlite3`
**Storage**: SQLite (existing)
**Testing**: Vitest (implied)
**Target Platform**: Local CLI/Daemon
**Project Type**: Agent/CLI
**Performance Goals**: N/A (Refactor/Config)
**Constraints**: Local-first, minimal breaking changes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Local-First & Privacy**: ✅ Config remains local.
- **Extensibility by Design**: ✅ Tool refactoring enables easier future extensibility.
- **Orchestration & Context**: ✅ Memory limit manages context window better.
- **Developer Experience (DX)**: ✅ Config is standard generic yaml.
- **Reliability & Transparency**: ✅ Logging preserved in new factory.

## Project Structure

### Documentation (this feature)

```text
specs/014-tools-factory-memory-limit/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
src/
├── config/
│   ├── schemas.ts       # Updated: Add memory_limit
│   └── types.ts         # (If manual types exist, usually inferred from zod)
├── runtime/
│   ├── agent.ts         # Updated: Use memory_limit and ToolsFactory
│   ├── providers/
│   │   └── factory.ts   # Updated: Remove MCP instantiation
│   └── tools/
│       └── factory.ts   # New: ToolsFactory class
```

**Structure Decision**: A new `tools` directory in `runtime` matches the domain separation.

## Complexity Tracking

N/A - Standard Refactor.
