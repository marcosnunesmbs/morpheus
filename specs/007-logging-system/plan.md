# Implementation Plan: Logging System

**Branch**: `007-logging-system` | **Date**: 2026-01-29 | **Spec**: [specs/007-logging-system/spec.md](spec.md)
**Input**: Feature specification from `specs/007-logging-system/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement a persistent logging system to audit agent behavior and debug the CLI daemon. The system calls for a refactor of `DisplayManager` to use `winston` and `winston-daily-rotate-file`, ensuring dual output (console + file) and configurable retention policies via `ConfigManager`.

## Technical Context

**Language/Version**: TypeScript (Node.js >= 18)
**Primary Dependencies**: `winston`, `winston-daily-rotate-file`, `zod` (for config validation)
**Storage**: Local filesystem (`~/.morpheus/logs/`)
**Testing**: `vitest` (Project standard)
**Target Platform**: CLI (Node.js) on Windows/Linux/Mac
**Project Type**: CLI Agent
**Performance Goals**: Async logging to minimize impact on UI responsiveness.
**Constraints**: Must respect "Local-First" principle; logs stay local.
**Scale/Scope**: Daily rotation, default 14-day retention.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Local-First & Privacy**: ✅ PASSED. Logs are stored in `~/.morpheus/logs`, strictly local.
- **Extensibility by Design**: ✅ PASSED. Implementation is within core `DisplayManager` but uses standard libraries (`winston`).
- **Orchestration & Context**: ⬜ N/A (Infrastructure feature).
- **Developer Experience**: ✅ PASSED. Configurable via standard config file, zero-conf defaults.
- **Reliability & Transparency**: ✅ PASSED. Directly supports Principle V (Observability is mandatory).

## Project Structure

### Documentation (this feature)

```text
specs/007-logging-system/
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
│   ├── manager.ts       # [UPDATE] Add LogConfig schema validation
│   └── paths.ts         # [UPDATE] Define LOGS_DIR constant
├── runtime/
│   ├── display.ts       # [REFACTOR] Initialize winston logger & add logical branching
│   ├── types.ts         # [UPDATE] Add logging options to DisplayManager interfaces
│   └── __tests__/
│       └── display.test.ts # [UPDATE] Verify log persistence mocks
└── types/
    └── config.ts        # [UPDATE] Add LogConfig interface
```

**Structure Decision**: Feature is implemented strictly within the existing Monolith CLI structure (`src/`).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
