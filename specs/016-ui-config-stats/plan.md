# Implementation Plan: Advanced UI Configuration and Statistics

**Branch**: `016-ui-config-stats` | **Date**: 2026-02-01 | **Spec**: [specs/016-ui-config-stats/spec.md](spec.md)
**Input**: Feature specification from `/specs/016-ui-config-stats/spec.md`

## Summary

This feature enhances the Morpheus UI with:
1.  **Usage Statistics**: A dashboard widget showing total Input and Output tokens, calculated by aggregating the local SQLite message history.
2.  **Audio Configuration**: A dedicated tab in Settings for configuring Audio providers (Google/Gemini initially).
3.  **LLM Configuration**: Adding a "Max Tokens" (context limit) setting to the LLM configuration.

## Technical Context

**Language/Version**: Node.js >= 18, TypeScript (Strict)
**Primary Dependencies**: React 19 (Vite), TailwindCSS, express (API), better-sqlite3 (DB), zod (Validation)
**Storage**: SQLite (`~/.morpheus/memory/short-memory.db`), YAML (`~/.morpheus/config.yaml`)
**Testing**: Vitest (Backend), Manual UI verification
**Target Platform**: Local Desktop (Windows/Linux/macOS)
**Project Type**: Agent Daemon + Web Interface
**Performance Goals**: Dashboard stats load < 200ms
**Constraints**: Local-first data (no cloud analytics), SQLite synchronous/async availability

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Local-First & Privacy**: ✅ Validated. Statistics are computed locally from local DB. No telemetry.
- **Extensibility**: ✅ Validated. Uses standard schema and API patterns.
- **Orchestration**: N/A (UI feature).
- **Developer Experience**: ✅ Validated. configuration via UI is user-friendly.
- **Reliability**: ✅ Validated. Uses existing persistent storage.

## Project Structure

### Documentation (this feature)

```text
specs/016-ui-config-stats/
├── plan.md              # This file
├── research.md          # Implementation decisions
├── data-model.md        # Function/Schema definitions
├── quickstart.md        # Testing guide
├── contracts/           # API types
│   └── api-stats.ts
└── tasks.md             # Task breakdown
```

### Source Code

```text
src/
├── config/
│   └── schemas.ts       # Update ConfigSchema (llm.max_tokens, audio.provider)
├── runtime/
│   └── memory/
│       └── sqlite.ts    # Add getUsageStats() method
├── http/
│   ├── api.ts           # Add /stats/usage endpoint
│   └── server.ts
└── ui/
    └── src/
        ├── types/       # Update Config types
        ├── services/    # Add StatsService
        ├── pages/
        │   ├── Dashboard.tsx # Integrate StatsWidget
        │   └── Settings.tsx  # Update LLM, New Audio tab
        └── components/
            └── dashboard/
                └── UsageStatsWidget.tsx # New component
```

**Structure Decision**: Extending existing Daemon/UI structure.

## Complexity Tracking

No constitution violations.
