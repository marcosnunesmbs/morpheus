# Research & Design Decisions: Settings Form UI

**Feature**: Settings Form UI
**Date**: January 29, 2026

## Decision 1: Shared Validation Schema
**Context**: The backend uses Zod in `src/config/manager.ts`. The frontend needs to validate inputs before sending.
**Decision**: Refactor the Zod schema from `manager.ts` into a cleaner separation (e.g., `src/types/schemas.ts` or export directly if safe) to allow the frontend to import it.
**Rationale**: 
- DRY (Don't Repeat Yourself).
- Frontend validation guarantees backend success (mostly).
- The `ui` package already links to root via `file:../..`, so importing from `src/types` or similar is possible.
**Risk**: If `manager.ts` has Node-specific imports, we cannot import it in React. We must extract the Zod schema to a file with NO Node.js dependencies (just `zod` and types).

## Decision 2: State Management
**Context**: We need to load config, edit it, track "dirty" state, and save.
**Decision**: Use `SWR` for fetching `GET /api/config`. Use local React state (or a form library/context) for the editing buffer.
**Rationale**: 
- `SWR` handles revalidation and caching for the "server state".
- Local state handles the "draft" state.
- Comparison between `SWR` data and Local state determines "dirty" flag.

## Decision 3: API Method
**Context**: Updating config.
**Decision**: `POST /api/config` with the FULL configuration object.
**Rationale**: 
- Simpler to implement than `PATCH` with partial merges for nested YAML.
- `ConfigManager` likely overwrites the file anyway.
- Race conditions are low risk for a single-user local tool.

## Decision 4: Form UX
**Context**: Configuration is nested (Agent, LLM, Channels, etc.).
**Decision**: Use a "Tabs" or "Sidebar" layout within the Settings page.
- Section 1: General (Agent Identity)
- Section 2: LLM (Provider, API Keys)
- Section 3: Interface (Port, Logging)
- Section 4: Channels (Telegram, etc.)
**Rationale**: Listing all fields in one long page is overwhelming.

## Alternatives Considered
- **Formik/React Hook Form**: Might be overkill for a relatively static settings form, but `react-hook-form` is good for performance. *Verdict*: Stick to controlled inputs or simple state for now unless complexity grows.
- **Auto-save**: *Verdict*: Rejected. Explicit "Save" is safer for configuration changes that might crash the agent (e.g., changing ports or keys).
