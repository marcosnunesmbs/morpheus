# Implementation Plan: NPM Publish Configuration

**Branch**: `011-npm-publish-setup` | **Date**: 2026-01-29 | **Spec**: [specs/011-npm-publish-setup/spec.md](../spec.md)
**Input**: Feature specification from `specs/011-npm-publish-setup/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Enable global installation of the Morpheus CLI via `npm install -g` by configuring `package.json` for publication, ensuring build artifacts (CLI and Web UI) are correctly bundled, and verifying the execution path for the global binary.

## Technical Context

**Language/Version**: Node.js 18+ (ESM)
**Primary Dependencies**: Commander, Express, React (UI)
**Storage**: N/A
**Testing**: Manual installation testing, Vitest
**Target Platform**: Any Node.js supported OS (Windows, macOS, Linux)
**Project Type**: CLI tool with embedded Web UI
**Performance Goals**: N/A
**Constraints**: Must work with standard `npm install -g` without post-install compile steps for the user.
**Scale/Scope**: Configuration only.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Local-First & Privacy**: ✅ Publishing infrastructure only. No data handling changes.
- **Extensibility**: ✅ No impact.
- **Orchestration**: ✅ No impact.
- **Developer Experience**: ✅ Directly supports Principle IV ("Installation MUST be via standard package managers").
- **Reliability & Transparency**: ✅ Standardizing installation improves reliability.

## Project Structure

### Documentation (this feature)

```text
specs/011-npm-publish-setup/
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
├── cli/                # Entry point and commands
├── http/               # Express server and API
├── ui/                 # React Frontend
├── config/             # Configuration schemas and management
└── runtime/            # Core logic
```

**Structure Decision**: Standard monorepo-lite structure with backend (src) and frontend (src/ui) collocated.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
