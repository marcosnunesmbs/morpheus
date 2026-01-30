# Research & Findings: NPM Publish Configuration

**Status**: Resolved
**Date**: 2026-01-29

## Decision Log

### 1. Build Lifecycle Script
**Decision**: Use `prepublishOnly`.
**Rationale**: We want to ensure that `npm run build` (which builds TS and UI) is executed automatically before publishing to the registry. We do NOT want it running on `npm install` (consumer side) because the package should contain the compiled assets. `prepare` runs on `npm install` from git dependencies, which might be okay, but `prepublishOnly` is stricter for registry publishing.
**Alternatives**:
- `prepare`: Runs on local install too. Good for dev, but we already have `npm run build`.
- `prepack`: Similar to `prepublishOnly` but runs on `npm pack`.

### 2. Package Whitelist
**Decision**: Use `files` array in `package.json` to explicitly whitelist distributables.
**List**:
- `dist/` (Compiled backend and frontend)
- `bin/` (CLI entry point)
- `README.md`
- `LICENSE`
**Rationale**: Prevents accidental publication of source files (`src/`), tests, or config files (`tsconfig.json`, `vite.config.ts`) that are not needed at runtime.

### 3. Local Testing Strategy
**Decision**: Use `npm install -g .` for end-to-end verification.
**Rationale**: `npm link` uses symlinks which can sometimes mask path resolution issues (e.g., `__dirname` resolution behavior might differ). `npm install -g .` packs the project and installs it like a real package.

## Clarifications Resolved

- **UI Assets Location**: Verified that `vite.config.ts` outputs to `../../dist/ui` and `src/http/server.ts` looks in `../ui` relative to `dist/http/`. This alignment is correct.
- **Dependencies**: All dependencies are currently in `dependencies`. Dev tools are in `devDependencies`. This structure is correct for a CLI tool.
