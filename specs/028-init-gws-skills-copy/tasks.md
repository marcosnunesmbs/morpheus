# Tasks: Initialize Google Workspace Skills

**Input**: Design documents from `/specs/028-init-gws-skills-copy/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

**Tests**: Unit tests for sync logic and configuration are included as requested by the development standards (vitest).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Update `src/types/config.ts` to include `GwsConfig` interface
- [x] T002 Update `src/config/schemas.ts` to include `GwsConfigSchema`
- [x] T003 [P] Update `src/config/manager.ts` to handle `gws` config and env var overrides (`MORPHEUS_GWS_SERVICE_ACCOUNT_JSON`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Update `Dockerfile` to include `gws` CLI installation commands
- [x] T005 [P] Implement MD5 hash utility function in `src/runtime/hash-utils.ts`
- [x] T006 [P] Create `src/runtime/gws-sync.ts` with basic directory traversal logic

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Automatic Skill Availability (Priority: P1) 🎯 MVP

**Goal**: Automatically copy skills from `gws-skills/skills/` to `.morpheus/skills/` during startup.

**Independent Test**: Delete `.morpheus/skills/gws-*` files, start daemon, and verify files are recreated.

### Tests for User Story 1

- [x] T007 [P] [US1] Create unit tests for `syncSkills` logic in `src/runtime/__tests__/gws-sync.test.ts`
- [x] T008 [US1] Ensure tests fail (RED) before implementation

### Implementation for User Story 1

- [x] T009 [US1] Implement `syncSkills` function in `src/runtime/gws-sync.ts` (handling basic copy and MD5 Smart Sync)
- [x] T010 [US1] Integrate `syncSkills()` into `src/runtime/scaffold.ts` inside the `scaffold()` function
- [x] T011 [US1] Add logging for skill sync results (X new, Y updated) in `src/runtime/gws-sync.ts`

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently.

---

## Phase 4: User Story 3 - Headless Authentication (Priority: P1)

**Goal**: Use Service Account JSON for non-interactive `gws` CLI authentication.

**Independent Test**: Provide a valid Service Account JSON in config and run a `gws` command to verify success.

### Implementation for User Story 3

- [x] T012 [US3] Update `src/runtime/subagents/devkit-instrument.ts` to inject `GOOGLE_APPLICATION_CREDENTIALS` when executing `gws` commands
- [x] T013 [US3] Implement validation in `src/runtime/gws-sync.ts` to verify the Service Account JSON exists and is valid

---

## Phase 5: User Story 4 - Pre-installed Tools (Priority: P1)

**Goal**: Ensure `gws` CLI is available in the Docker environment.

**Independent Test**: Build Docker image and run `docker run ... gws --version`.

### Implementation for User Story 4

- [x] T014 [US4] Finalize `Dockerfile` changes to ensure `gws` binary is in `/usr/local/bin` and has execution permissions
- [x] T015 [US4] Update `src/runtime/gws-sync.ts` to check if `gws` binary is in system PATH and log a warning/error if missing

---

## Phase 6: User Story 2 - Oracle Skill Discovery (Priority: P2)

**Goal**: Ensure Oracle agent correctly discovers and loads the newly copied GWS skills.

**Independent Test**: Ask Oracle "What Google Workspace tools do you have?" after a fresh start.

### Implementation for User Story 2

- [x] T016 [US2] Verify `SkillRegistry` correctly picks up files in `.morpheus/skills/` (Verified: automatic directory watching)
- [ ] T017 [US2] Add an integration test in `src/runtime/__tests__/oracle-gws.test.ts` to verify Oracle can describe GWS tools

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T018 [P] Update `specs/028-init-gws-skills-copy/quickstart.md` with final configuration details
- [x] T019 [P] Ensure all logs follow the project's structured logging standard
- [x] T020 [P] Final run of `npx vitest run` to ensure no regressions
- [ ] T021 [P] Manual validation of the full flow (Requires credentials)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories.
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion.
  - US1 (P1) is the MVP and should be completed first.
  - US3 and US4 can be worked on in parallel with US1 as they affect different files (devkit and Dockerfile).
  - US2 depends on US1 being functional (skills must be present to be discovered).
- **Polish (Final Phase)**: Depends on all user stories being complete.

### Parallel Opportunities

- T003 can run in parallel with T001/T002.
- T005 and T006 can run in parallel.
- T007 can run in parallel with early US1 implementation.
- US3 (T012, T013) and US4 (T014, T015) can run in parallel with US1 implementation.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Setup + Foundational.
2. Complete User Story 1 (Syncing skills).
3. **STOP and VALIDATE**: Verify skills are copied correctly to `.morpheus/skills/`.

### Incremental Delivery

1. Foundation + US1 -> Skills are automatically available.
2. Add US3 -> Authentication works headlessly.
3. Add US4 -> Environment is ready for production (Docker).
4. Add US2 -> Oracle explicitly confirms availability.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to specific user story for traceability.
- Each user story is independently completable and testable.
- Vitest is the standard testing tool for this project.
