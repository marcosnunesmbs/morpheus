# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement the core CLI structure for Morpheus, enabling global installation, configuration management, and lifecycle control (start/stop/status). This foundation establishes the `.morpheus` global directory and provides the scaffolding for future agent capabilities.

## Technical Context

**Language/Version**: Node.js >= 18, TypeScript
**Primary Dependencies**: `commander`, `ora`, `chalk`, `open`, `js-yaml`
**Storage**: File System (`~/.morpheus`)
**Testing**: Vitest
**Target Platform**: Cross-platform (Windows, macOS, Linux)
**Project Type**: CLI Application
**Performance Goals**: CLI startup < 200ms
**Constraints**: Must work locally without internet (except for initial install/setup)
**Scale/Scope**: Single user

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Standard**: Follows SpecKit file structure.
- **Local-First**: Config and state stored locally.

## Project Structure

### Documentation (this feature)

```text
specs/001-cli-structure/
├── plan.md              
├── research.md          
├── data-model.md        
├── quickstart.md        
├── contracts/           
└── checklists/
```

### Source Code (repository root)

```text
bin/
└── morpheus.js           # Executable entry point

src/
├── cli/
│   ├── index.ts          # CLI entry / Commander setup
│   ├── commands/         # Command implementations
│   │   ├── start.ts
│   │   ├── stop.ts
│   │   ├── status.ts
│   │   ├── config.ts
│   │   └── doctor.ts
│   └── utils/
│       └── render.ts     # UI rendering (chalk/tables)
├── config/
│   ├── manager.ts        # Config loader (singleton)
│   └── paths.ts          # Path resolution (~/.morpheus)
├── runtime/
│   └── lifecycle.ts      # Start/Stop logic & PID handling
└── types/
    └── config.ts         # TypeScript interfaces
```

**Structure Decision**: Standard TypeScript CLI structure with separated concerns (CLI layer vs Runtime logic).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
