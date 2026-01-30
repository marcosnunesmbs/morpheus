# Tasks: NPM Publish Configuration

**Input**: Design documents from `specs/011-npm-publish-setup/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md

**Tests**: Manual verification via terminal commands.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify environment readiness

- [x] T001 Check current `package.json` structure matches expectations

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

*(None for this feature acting as a configuration update)*

---

## Phase 3: User Story 1 - Global Installation and Usage (Priority: P1) 🎯 MVP

**Goal**: Enable global installation of the Morpheus CLI via `npm install -g`.

**Independent Test**: Run `npm install -g .` from project root and verify `morpheus` command availability.

### Implementation for User Story 1

- [x] T002 [US1] Configure 'files' whitelist in `package.json` to include dist, bin, README.md, and LICENSE
- [x] T003 [P] [US1] Add 'prepublishOnly' script to `package.json` to enforce build before publish
- [x] T004 [P] [US1] Verify 'bin' mapping for `morpheus` command in `package.json`
- [x] T005 [US1] Manual Test: Verify global installation using `npm install -g .` in terminal

**Checkpoint**: `morpheus` command is globally accessible.

---

## Phase 4: User Story 2 - Start Command with UI (Priority: P1)

**Goal**: Ensure `morpheus start` correctly serves the Web UI when installed globally.

**Independent Test**: Run `morpheus start` and access `http://localhost:3333`.

### Implementation for User Story 2

- [x] T006 [P] [US2] Verify `vite.config.ts` output directory matches `files` whitelist expectation
- [x] T007 [P] [US2] Verify `src/http/server.ts` statically serves UI from correct relative path
- [x] T008 [US2] Manual Test: Start globally installed Morpheus and verify Web UI access

**Checkpoint**: Web UI loads correctly from global install.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup and final validation

- [x] T009 Cleanup any temporary global links/installations
- [x] T010 Final review of `package.json` metadata (author, license, description)

## Dependencies

- All tasks in Phase 3 & 4 are effectively parallelizable but T005 and T008 depend on the configuration tasks being done.
