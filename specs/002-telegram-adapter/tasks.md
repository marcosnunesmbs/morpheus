---
description: "Task list for Telegram Channel Adapter implementation"
---

# Tasks: Telegram Channel Adapter

**Input**: Design documents from `/specs/002-telegram-adapter/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are manual verification steps as requested in the plan/spec. No automated tests were explicitly requested.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Project root: `src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Install `telegraf` dependency in `package.json`
- [x] T002 Update config types in `src/types/config.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 [P] Implement `setByPath` utility in `src/config/utils.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Secure Configuration (Priority: P1) 🎯 MVP

**Goal**: Configure the Bot Token via the CLI without manually editing YAML files

**Independent Test**: Can be tested by running the config command and verifying `config.yaml` is updated correctly

### Implementation for User Story 1

- [x] T004 [US1] Update `ConfigManager` with `set` method in `src/config/manager.ts`
- [x] T005 [P] [US1] Implement `config set` command structure in `src/cli/commands/config.ts`
- [x] T006 [US1] Implement value parsing logic for `set` command in `src/cli/commands/config.ts`
- [x] T007 [US1] Manual verification: Run `morpheus config set` and check `config.yaml`

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Adapter Lifecycle (Priority: P1)

**Goal**: Telegram Bot connects automatically when Morpheus starts

**Independent Test**: Can be tested by running `morpheus start` and checking console logs for connection success

### Implementation for User Story 2

- [x] T008 [P] [US2] Create `TelegramAdapter` class in `src/channels/telegram.ts`
- [x] T009 [US2] Implement `connect` and `disconnect` methods in `src/channels/telegram.ts`
- [x] T010 [US2] Integrate adapter initialization in `src/cli/commands/start.ts`
- [x] T011 [US2] Ensure graceful shutdown logic in `src/cli/commands/start.ts` and `src/channels/telegram.ts`
- [x] T012 [US2] Manual verification: Run `morpheus start` and verify connection log

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Message Reception (Priority: P2)

**Goal**: Incoming messages are logged in the console

**Independent Test**: Can be tested by sending a message to the bot from a mobile phone and watching the CLI output

### Implementation for User Story 3

- [x] T013 [US3] Implement message listener for logging in `src/channels/telegram.ts`
- [x] T014 [US3] Manual verification: Receive and log a test message

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T015 Ensure no console errors on invalid tokens in `src/channels/telegram.ts`
- [x] T016 Run quickstart.md validation steps

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel
  - Or sequentially in priority order (P1 → P1 → P2)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - May integrate with US1 config but uses adapter class mostly
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Extends US2 adapter logic

### Parallel Opportunities

- T003 (Utils) and T008 (Adapter Class) can run in parallel
- T005 (Config Command) and T008 (Adapter Class) can run in parallel
- Once Foundational phase completes, US1 and US2 can start in parallel

---

## Parallel Example: User Story 2

```bash
# Launch implementation parts for User Story 2 together:
Task: "Create `TelegramAdapter` class in `src/channels/telegram.ts`"
Task: "Integrate adapter initialization in `src/cli/commands/start.ts`"
```

---

## Implementation Strategy

### MVP First (User Story 1 & 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (Config)
4. Complete Phase 4: User Story 2 (Lifecycle)
5. **STOP and VALIDATE**: Test basic connectivity
6. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently
3. Add User Story 2 → Test independently (Connected!)
4. Add User Story 3 → Test independently (Messages receiving!)

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Config)
   - Developer B: User Story 2 (Adapter)
   - Developer C: User Story 3 (Messages) (After B starts)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
