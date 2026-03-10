# Tasks: Morpheus Internal Tools Integration

**Input**: Design documents from `/specs/[###-feature-name]/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: The examples below include test tasks. Tests are OPTIONAL - only include them if explicitly requested in the feature specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- **Web app**: `backend/src/`, `frontend/src/`
- **Mobile**: `api/src/`, `ios/src/` or `android/src/`
- Paths shown below assume single project - adjust based on plan.md structure

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create tools directory structure in src/runtime/tools/
- [x] T002 [P] Set up tool type definitions in src/types/tools.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

Examples of foundational tasks (adjust based on your project):

- [x] T003 [P] Create base tool implementations in src/runtime/tools/index.ts
- [x] T004 Update provider factory to accept new tools in src/runtime/providers/factory.ts
- [x] T005 [P] Import and register new tools in the agent creation process

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Configuration Management Tools (Priority: P1) 🎯 MVP

**Goal**: Enable querying and updating of Morpheus configurations through internal tools

**Independent Test**: Can call configuration query and update tools and verify they return accurate values and apply changes correctly

### Implementation for User Story 1

- [x] T006 [P] [US1] Create ConfigQueryTool in src/runtime/tools/config-tools.ts
- [x] T007 [P] [US1] Create ConfigUpdateTool in src/runtime/tools/config-tools.ts
- [x] T008 [US1] Implement configuration validation using existing Zod schemas
- [x] T009 [US1] Add new tools to the agent factory in src/runtime/providers/factory.ts
- [x] T010 [US1] Test configuration tools work with existing ConfigManager

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Diagnostic Tools Integration (Priority: P1)

**Goal**: Enable system health diagnostics through internal tools, similar to the doctor command

**Independent Test**: Can call diagnostic tools and verify they return accurate system health information

### Implementation for User Story 2

- [x] T011 [P] [US2] Create DiagnosticTool in src/runtime/tools/diagnostic-tools.ts
- [x] T012 [US2] Adapt existing doctor command logic from src/cli/commands/doctor.ts
- [x] T013 [US2] Add diagnostic tool to the agent factory in src/runtime/providers/factory.ts
- [x] T014 [US2] Test diagnostic tool provides comprehensive system health report

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Database Analytics Tools (Priority: P2)

**Goal**: Enable querying of database statistics like message counts and token usage through internal tools

**Independent Test**: Can call analytics tools and verify they return accurate database statistics

### Implementation for User Story 3

- [x] T015 [P] [US3] Create MessageCountTool in src/runtime/tools/analytics-tools.ts
- [x] T016 [P] [US3] Create TokenUsageTool in src/runtime/tools/analytics-tools.ts
- [x] T017 [US3] Implement database query logic for analytics with ISO 8601 time range filters (start/end datetime format)
- [x] T018 [US3] Add analytics tools to the agent factory in src/runtime/providers/factory.ts
- [x] T019 [US3] Test analytics tools return accurate data from SQLite database

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: User Story 4 - Tool Integration with Agent Factory (Priority: P1)

**Goal**: Ensure all new tools are automatically available across all supported LLM providers

**Independent Test**: New tools appear in the tools list for each provider after factory integration

### Implementation for User Story 4

- [x] T020 [US4] Update factory to include all new tools in toolsForAgent array
- [x] T021 [US4] Test that tools are available across different LLM providers
- [x] T022 [US4] Verify tools work consistently across all supported providers
- [x] T023 [US4] Update documentation for new tools availability

**Checkpoint**: All tools should be available across all providers

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T024 [P] Update documentation in docs/ for new tools
- [x] T025 Export all new tools in src/runtime/tools/index.ts
- [x] T026 [P] Add unit tests for new tools in tests/
- [x] T027 Run quickstart.md validation to ensure all tools work as expected
- [x] T028 Update README with information about new internal tools

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 4 (P1)**: Can start after Foundational (Phase 2) - Depends on all other stories being implemented

### Within Each User Story

- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch all components for User Story 1 together:
Task: "Create ConfigQueryTool in src/runtime/tools/config-tools.ts"
Task: "Create ConfigUpdateTool in src/runtime/tools/config-tools.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Add User Story 4 → Test independently → Deploy/Demo
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1
   - Developer B: User Story 2
   - Developer C: User Story 3
   - Developer D: User Story 4
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence