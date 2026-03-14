# Implementation Plan: Initialize Google Workspace Skills

**Branch**: `028-init-gws-skills-copy` | **Date**: 2026-03-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/028-init-gws-skills-copy/spec.md`

## Summary

Initialize Morpheus with built-in Google Workspace skills by copying them from `gws-skills/skills/` to the user's `.morpheus/skills/` directory during startup. This includes a Smart Sync mechanism using MD5 hashes to protect user customizations and the integration of the `gws` CLI for non-interactive Service Account authentication, pre-installed via the project's Dockerfile.

## Technical Context

**Language/Version**: Node.js >= 18, TypeScript (Strict Mode)
**Primary Dependencies**: `morpheus-devkit`, `langchain`, `crypto` (built-in for MD5)
**Storage**: Filesystem (`.morpheus/skills/`), `zaion.yaml` for config
**Testing**: `vitest`
**Target Platform**: Linux (Docker), macOS, Windows
**Project Type**: CLI Daemon / AI Operator
**Performance Goals**: Init copy/sync < 200ms
**Constraints**: Local-first (Service Account keys MUST stay local), MD5-based Smart Sync
**Scale/Scope**: ~10-20 default GWS skills, 1 CLI tool integration (`gws`)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

1. **Local-First & Privacy**: ✅ Service Account JSON is stored locally and referenced via config. No credentials sent to Morpheus cloud.
2. **Extensibility**: ✅ Uses the existing skills system (`.morpheus/skills/`).
3. **Orchestration & Context**: ✅ Provides Oracle with GWS context via tool definitions.
4. **Developer Experience**: ✅ Automatic setup of skills; Docker-ready CLI.
5. **Reliability & Transparency**: ✅ Logging of sync operations and clear error handling for missing CLI/keys.

## Project Structure

### Documentation (this feature)

```text
specs/028-init-gws-skills-copy/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── runtime/
│   └── scaffold.ts      # New: syncSkills() function called during initialization
├── config/
│   ├── schemas.ts       # New: GwsConfigSchema for validation
│   └── manager.ts       # New: getGwsConfig() with env var overrides
├── types/
│   └── config.ts        # New: GwsConfig interface
└── devkit/
    └── index.ts         # Update: Inject GOOGLE_APPLICATION_CREDENTIALS into shell tools
```

**Structure Decision**: Option 1 (Single project). Morpheus is a unified Node.js/TypeScript daemon.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
