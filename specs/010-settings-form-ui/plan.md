# Implementation Plan: Settings Form UI

**Branch**: `010-settings-form-ui` | **Date**: January 29, 2026 | **Spec**: [specs/010-settings-form-ui/spec.md](specs/010-settings-form-ui/spec.md)
**Input**: Feature specification from `specs/010-settings-form-ui/spec.md`

## Summary

Implement a settings management UI in the dashboard that allows users to view and modify the `config.yaml` file through a structured form. This involves creating API endpoints in the Express server to GET/POST configuration and building a React-based settings page with form validation, dirty state tracking, and logical sectioning.

## Technical Context

**Language/Version**: TypeScript 5.9 (shared), Node.js (backend), React 19 (frontend)
**Primary Dependencies**: 
- Backend: Express 5, Zod (validation), fs-extra (persistence)
- Frontend: React 19, TailwindCSS, SWR (data fetching), Lucide (icons)
**Storage**: `config.yaml` (via existing `ConfigManager`)
**Testing**: Vitest (backend unit tests)
**Target Platform**: Local Web Server (running alongside CLI)
**Project Type**: Full Stack (Node.js CLI + Vite SPA)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Local-First & Privacy**: PASSED. Configuration is stored locally in `~/.morpheus/config.yaml`. No cloud sync.
- **Extensibility by Design**: N/A. Core configuration feature.
- **Orchestration & Context**: N/A.
- **Developer Experience (DX)**: PASSED. Provides a GUI alternative to manual YAML editing, improving accessibility.
- **Reliability & Transparency**: PASSED. Uses Zod for strict validation preventing invalid states.

## Project Structure

### Documentation (this feature)

```text
specs/010-settings-form-ui/
├── plan.md              # This file
├── research.md          # Technology decisions and schema patterns
├── data-model.md        # API payload definitions
├── quickstart.md        # Usage guide
├── contracts/           # API definitions
│   └── config-api.md
└── tasks.md             # Implementation tasks
```

### Source Code

```text
src/
├── config/
│   ├── manager.ts       # logic to save config
│   └── schemas.ts       # [NEW] Extract Zod schema for shared use (if possible)
├── http/
│   └── api.ts           # Add /config routes
├── ui/src/
│   ├── components/
│   │   ├── forms/       # [NEW] Reusable form inputs
│   │   └── settings/    # [NEW] Settings section components
│   ├── pages/
│   │   └── Settings.tsx # [NEW] Main settings page
│   └── services/
│       └── config.ts    # [NEW] API client for config
```

**Structure Decision**: Validated against existing `src/` layout.

## Complexity Tracking

N/A - No violations.
