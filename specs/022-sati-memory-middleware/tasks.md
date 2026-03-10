# Tasks: Sati Memory Middleware

**Input**: Design documents from `/specs/022-sati-memory-middleware/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create feature directory structure `src/runtime/memory/sati/`
- [x] T002 Implement Types and Interfaces in `src/runtime/memory/sati/types.ts` (port from `contracts/interfaces.ts`)
- [x] T003 [P] Implement System Prompts in `src/runtime/memory/sati/system-prompts.ts` (from spec prompts)

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [x] T004 Implement `SatiRepository` in `src/runtime/memory/sati/repository.ts` (SQLite connection, schema migration, `santi-memory.db` isolation)
- [x] T005 Update `src/cli/index.ts` to call `SatiRepository.initialize()` during `init` command
- [x] T006 Implement `SatiService` skeleton in `src/runtime/memory/sati/service.ts` with `initialize()` and connection to repository

**Checkpoint**: Foundation ready - DB created and accessible.

## Phase 3: User Story 1 - Contextual Memory Retrieval (Priority: P1) 🎯 MVP

**Goal**: System recalls past details when user sends a message.

**Independent Test**: Manually insert memory in DB, run agent with relevant prompt, verify system message injection.

### Implementation

- [x] T007 [US1] Implement `SatiService.recover` method: Text search + relevance sorting + limit (5)
- [x] T008 [US1] Implement `SatiMemoryMiddleware.beforeAgent` hook: Call `service.recover` -> Inject `SystemMessage`
- [x] T009 [US1] Unit Test: `SatiService.recover` limits and sorting using mock repository
- [x] T010 [US1] Register middleware in `src/runtime/agent.ts` (or wherever middleware creation happens) to active `beforeAgent` only

**Checkpoint**: Agent can "read" minds (memory).

## Phase 4: User Story 2 & 3 - Consolidation & Deduplication (Priority: P1)

**Goal**: System saves new facts automatically and avoids duplicates.

**Independent Test**: Chat with agent, check DB for new record. Repeat fact, check DB for update (no dupe).

### Implementation

- [x] T011 [US2] Implement `SatiService.evaluateAndPersist`: invoke sub-agent (Zion LLM) to classify/summarize
- [x] T012 [US3] Implement deduplication logic in `SatiRepository.save`: Check hash + similarity -> Insert or Update
- [x] T013 [US2] Implement `SatiMemoryMiddleware.afterAgent` hook: Call `service.evaluateAndPersist`
- [x] T014 [US2] Unit Test: `SatiService.evaluate` with mock LLM response (JSON parsing)
- [x] T015 [US2] Unit Test: `SatiRepository` deduplication (Hash collision test)

**Checkpoint**: Agent can "write" memories.

## Phase 5: User Story 4 - Isolated Infrastructure (Priority: P3)

**Goal**: Ensure specific constraints (init command, separate DB).

**Independent Test**: Run `morpheus init` on fresh env, check `santi-memory.db`.

### Implementation

- [x] T016 [US4] Verify `morpheus init` integration (already added in T005, verifying/refining)
- [x] T017 [US4] Add "Doctor" check for memory DB health in `src/runtime/capabilities.ts` or `doctor` command
