---
description: "Task list for Refactor Tools Factory & Memory Config"
---

# Tasks: Refactor Tools Factory & Memory Config

**Input**: Design documents from `/specs/014-tools-factory-memory-limit/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Test tasks not explicitly requested, focusing on implementation.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create directory `src/runtime/tools`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T002 Update `MorpheusConfig` interfaces in `src/types/config.ts` to include `memory` configuration
- [x] T002b Update `DEFAULT_CONFIG` in `src/config/schemas.ts` (or relevant file) to include default memory limit

**Checkpoint**: Configuration types ready

---

## Phase 3: User Story 1 - Configurable Context Memory Limit (Priority: P1) 🎯 MVP

**Goal**: The user wants to control how many past messages are included in the context window sent to the LLM.

**Independent Test**: Can be tested by changing the config value and verifying the number of messages loaded by the Agent.

### Implementation for User Story 1

- [x] T003 [US1] Update `ConfigSchema` in `src/config/schemas.ts` to include `memory` section with default limit
- [x] T004 [US1] Update `Agent` initialization in `src/runtime/agent.ts` to use configured memory limit
- [x] T004b [US1] Add unit test in `src/runtime/__tests__/agent.test.ts` to verify memory limit is respected

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Modular Tools Architecture (Priority: P2)

**Goal**: As a developer, I want the tool creation logic separated from the LLM provider logic.

**Independent Test**: Verify by code inspection and ensuring the Agent still has access to tools (e.g., CoinGecko) after refactoring.

### Implementation for User Story 2

- [x] T005 [P] [US2] Create `ToolsFactory` in `src/runtime/tools/factory.ts` matching the data model
- [x] T006 [P] [US2] Move MCP client instantiation logic from `src/runtime/providers/factory.ts` to `src/runtime/tools/factory.ts` (Ensure logging hooks are preserved)
- [x] T007 [US2] Update `ProviderFactory` in `src/runtime/providers/factory.ts` to accept tools as argument
- [x] T008 [US2] Update `Agent` in `src/runtime/agent.ts` to initialize tools via `ToolsFactory` and pass to provider
- [x] T008b [US2] Create unit test `src/runtime/tools/__tests__/factory.test.ts` to verify `ToolsFactory` creation

**Checkpoint**: At this point, User Story 2 should be fully functional and testable independently

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Final review, cleanup, and non-functional requirements

- [x] T009 Verify `morpheus init` generates config with memory limit (Manual)
- [x] T010 Verify `morpheus start` loads with new memory limit (Manual)

## Dependencies

- **US1** requires **Phase 2 (T002)**
- **US2** requires **Phase 1 (T001)** and can be done after US1 to ensure stable Agent base, though they are technically independent if properly merged.
- **T008** depends on **T005** and **T007**.

## Parallel Execution Examples

- **T005** (Create ToolsFactory) and **T006** (Move Logic) can be worked on while **T003** (Config Schema) is being done by another developer, assuming T002 is shared or trivial.
- **T005** and **T006** are effectively one large refactor task, split for clarity.

## Implementation Strategy

1.  **MVP (US1)**: First, enable the configuration. This delivers immediate value to the user who wants to control costs/context.
2.  **Refactor (US2)**: Once memory is configurable, refactor the tools architecture. This is safer as it touches the same `agent.ts` file, but US1 changes are minimal (one line in `agent.ts`) while US2 is structural. Doing US1 first ensures the config is ready when we might need to pass config to ToolsFactory later (even if not strictly needed now).
