# Tasks: CLI Structure

**Feature**: CLI Structure
**Status**: Pending
**Spec**: [spec.md](spec.md)

## Dependencies

- **Phase 1 (Setup)**: Blocks everything.
- **Phase 2 (Foundational)**: Blocks US1, US2, US3.
- **Phase 3 (US1)**: Independent execution.
- **Phase 4 (US2)**: Independent execution (needs Phase 2).
- **Phase 5 (US3)**: Independent execution (needs Phase 2).

## Implementation Strategy

We will build the CLI from the ground up, starting with the package structure and global path management. Then we establish the configuration layer which is a dependency for all commands. Finally, we implement each command group as an isolated unit corresponding to the user stories.

## Phase 1: Setup

- [x] T001 Initialize project structure (package.json, tsconfig.json) in root `.`
- [x] T002 Install dependencies (`commander`, `ora`, `chalk`, `open`, `js-yaml`, `fs-extra`, `zod`, `vitest`)
- [x] T003 Create executable entry point in `bin/morpheus.js`

## Phase 2: Foundational

- [x] T004 Create types definition for configuration in `src/types/config.ts`
- [x] T005 [P] Implement path resolution utility in `src/config/paths.ts` (defining `~/.morpheus` paths)
- [x] T006 Implement Config Manager in `src/config/manager.ts` (load, validate, save config)
- [x] T007 Implement directory scaffolding logic in `src/runtime/scaffold.ts` (ensure `.morpheus` and subfolders exist)
- [x] T008 Setup main CLI entry point/router in `src/cli/index.ts`

## Phase 3: User Story 1 - Installation & Lifecycle

**Goal**: Enable users to start, stop, and check the agent status.

- [x] T009 [US1] Implement PID file management logic in `src/runtime/lifecycle.ts` (read, write, check stale)
- [x] T010 [US1] Implement `start` command logic in `src/cli/commands/start.ts` (call scaffold, write PID, block process)
- [x] T011 [P] [US1] Implement `stop` command logic in `src/cli/commands/stop.ts` (read PID, kill process, clean file)
- [x] T012 [P] [US1] Implement `status` command logic in `src/cli/commands/status.ts` (check PID & process existence)
- [x] T013 [US1] Register lifecycle commands in `src/cli/index.ts`

## Phase 4: User Story 2 - Configuration Management

**Goal**: Enable users to view and edit configuration effortlessly.

- [x] T014 [US2] Implement `config` command handler in `src/cli/commands/config.ts`
- [x] T015 [US2] Add logic to pretty-print config to stdout in `src/cli/commands/config.ts`
- [x] T016 [US2] Add logic to open config file with default editor (`open` lib) in `src/cli/commands/config.ts`
- [x] T017 [US2] Register config command in `src/cli/index.ts`

## Phase 5: User Story 3 - Environment Health Check

**Goal**: Enable users to self-diagnose environment issues.

- [x] T018 [US3] Implement Node.js version check and config validation check in `src/cli/commands/doctor.ts`
- [x] T019 [US3] Implement permissions check for global folder in `src/cli/commands/doctor.ts`
- [x] T020 [US3] Register doctor command in `src/cli/index.ts`

## Phase 6: Polish

- [x] T021 Add ASCII art banner and colorized output in `src/cli/utils/render.ts`
- [x] T022 Ensure `morpheus --help` output is clean and descriptive
