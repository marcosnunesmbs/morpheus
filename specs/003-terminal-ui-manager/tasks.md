---
description: "Task list for Unified Terminal Output Manager"
---

# Tasks: Unified Terminal Output Manager

**Input**: Design documents from `/specs/003-terminal-ui-manager/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Unit tests for core logic (Constitution req) + Manual verification steps.

**Organization**: Tasks are grouped by user story to enable independent implementation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel
- **[Story]**: Which user story this task belongs to
- Include exact file paths in descriptions

## Path Conventions

- Project root: `src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Define interfaces before implementation

- [x] T001 Create `src/types/display.ts` with `LogLevel`, `LogOptions` and `IDisplayManager` interfaces

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core logic for the DisplayManager (Singleton + Spinner Control)

**⚠️ CRITICAL**: Must be complete before refactoring components

- [x] T002 Create `DisplayManager` singleton in `src/runtime/display.ts` with `startSpinner` / `stopSpinner`
- [x] T003 Implement `log` method in `src/runtime/display.ts` with "Stop-Log-Start" logic
- [x] T003a Create unit tests for `DisplayManager` in `src/runtime/__tests__/display.test.ts` (Coverage: Singleton, Spinner State, Log Interruption)

**Checkpoint**: Core util is ready. Steps can now diverge or proceed sequentially.

---

## Phase 3: User Story 1 - Clear Logging (Priority: P1)

**Goal**: Logs prints clearly without breaking the spinner in the main agent loop.

**Independent Test**: Run `morpheus start`, wait for spinner, then verify initial logs don't ghost.

### Implementation for User Story 1

- [x] T004 [US1] Refactor `src/cli/commands/start.ts` to use `DisplayManager` for spinner and logging

**Checkpoint**: CLI main loop uses the new manager.

---

## Phase 4: User Story 2 - Source-Tagged Feedback (Priority: P1)

**Goal**: Logs have colored prefixes like `[Telegram]` or `[System]`.

**Independent Test**: Call `DisplayManager.log('test', { source: 'Test' })` and verify output.

### Implementation for User Story 2

- [x] T005 [US2] Enhance `log` method in `src/runtime/display.ts` to support source prefixes and coloring (chalk)

**Checkpoint**: Logs are now pretty.

---

## Phase 5: User Story 3 - Unified Output (Priority: P2)

**Goal**: Telegram messages use the shared manager.

**Independent Test**: Send a Telegram message and see `[Telegram]` in console while spinner spins.

### Implementation for User Story 3

- [x] T006 [US3] Refactor `src/channels/telegram.ts` to use `DisplayManager.log` instead of `console.log`

**Checkpoint**: Full integration complete.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T007 Verify graceful shutdown in `start.ts` calls `stopSpinner` correctly
- [x] T008 Add support for valid `ora` spinner replacement (e.g. if called twice, it updates instead of replacing)
- [x] T009 Verify `config set` logs also work cleanly if agent is running

---

## Dependencies & Execution Order

1. **Setup & Foundation** (T001-T003) MUST be done first.
2. **US1** (T004) depends on Foundation.
3. **US2** (T005) depends on Foundation (can be done before or after US1, but best after T003).
4. **US3** (T006) depends on US2 (for the source tags) and Foundation.

### Parallel Integration
- Once Foundation (T003) is done, T004 (CLI) and T006 (Telegram) could technically be done in parallel, but T006 needs T005 for the full effect.

## Implementation Strategy

1. Build the Manager (T001-T003)
2. Update the CLI main entry (T004)
3. Add Styles (T005)
4. Update Adapters (T006)
