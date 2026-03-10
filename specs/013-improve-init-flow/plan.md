# Implementation Plan: Improved Init Flow

**Branch**: `013-improve-init-flow` | **Date**: 2026-01-30 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/013-improve-init-flow/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Update the `morpheus init` command to:
1.  **Pre-fill defaults**: Smartly load existing configuration (if any) to populate prompt defaults.
2.  **Guide Audio Setup**: Add a specific flow for Audio Transcription configuration, handling API key requirements conditionally based on the selected LLM provider.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js >= 18
**Primary Dependencies**: `commander`, `@inquirer/prompts`, `zod`
**Storage**: `~/.morpheus/config.yaml` (Read/Write)
**Testing**: Manual verification (CLI prompts are hard to unit test in this architecture).
**Target Platform**: CLI
**Project Type**: Backend / CLI
**Performance Goals**: Init startup < 100ms.
**Constraints**: Must fail gracefully if config is corrupted.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Local-First & Privacy**: Keys remain local. Config logic is local.
- [x] **Extensibility**: Uses existing Config pattern.
- [x] **DX**: "Re-init" capability is a massive DX win.
- [x] **Reliability**: Validates inputs before saving.

## Project Structure

### Documentation (this feature)

```text
specs/013-improve-init-flow/
├── plan.md              # This file
├── research.md          # Flow details
├── data-model.md        # State logic
├── quickstart.md        # Usage
└── contracts/           # (Empty)
```

### Source Code (repository root)

```text
src/
└── cli/
    └── commands/
        └── init.ts      # Modified: added load logic, audio flow, and default handling
```

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A       |            |                                     |

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
