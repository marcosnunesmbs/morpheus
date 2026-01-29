# Tasks: SQLite Memory Persistence for LangChain

**Feature Branch**: `008-sqlite-memory-persistence`
**Status**: Implementation Complete ✅

## Phase 1: Setup
*Goal: Initialize environment and dependencies*

- [X] T001 Install `better-sqlite3` and `@types/better-sqlite3` in `package.json`
- [X] T002 Ensure directory `src/runtime/memory/` exists

## Phase 2: Foundational
*Goal: Implement the core Storage Adapter (Blocking for User Stories)*

- [X] T003 Create `SQLiteChatMessageHistory` class skeleton implementing `BaseListChatMessageHistory` in `src/runtime/memory/sqlite.ts`
- [X] T004 Implement `ensureTable()` private method to create `messages` table if not exists in `src/runtime/memory/sqlite.ts`
- [X] T005 Implement `addMessage(message: BaseMessage)` to serialize and insert rows in `src/runtime/memory/sqlite.ts`
- [X] T006 Implement `getMessages()` to select, deserialize, and return `BaseMessage[]` in `src/runtime/memory/sqlite.ts`
- [X] T007 Implement `clear()` to truncate the session data in `src/runtime/memory/sqlite.ts`
- [X] T008 [P] Create unit tests for `SQLiteChatMessageHistory` (CRUD operations) in `src/runtime/memory/__tests__/sqlite.test.ts`

## Phase 3: User Story 1 (Persist Conversation) & User Story 2 (Restore)
*Goal: Connect Agent to persistent storage so conversations survive restarts*

- [X] T009 [US1] Modify `Agent` class properties to use `BaseListChatMessageHistory` instead of array in `src/runtime/agent.ts`
- [X] T010 [US1] Update `Agent.initialize()` to instantiate `SQLiteChatMessageHistory` with path from config config in `src/runtime/agent.ts`
- [X] T011 [US1] Refactor `Agent.chat()` to use `this.history.addMessage()` for user and AI messages in `src/runtime/agent.ts`
- [X] T012 [US2] Verify `Agent.chat()` correctly includes loaded history in the prompt context (inherited from `getMessages`) in `src/runtime/agent.ts`
- [X] T013 [P] [US1] Create integration test verifying file creation and data persistence in `src/runtime/__tests__/agent_persistence.test.ts`

## Phase 4: User Story 3 (Memory Management)
*Goal: User control over memory*

- [X] T014 [US3] Update `Agent.clearMemory()` to call `this.history.clear()` in `src/runtime/agent.ts`
- [X] T015 [P] [US3] Add test case for memory clearing in `src/runtime/__tests__/agent_persistence.test.ts`

## Phase 5: Polish & Cross-Cutting
*Goal: Robustness and cleanup*

- [X] T016 Add error handling for database locks, file permission errors, or corruption in `src/runtime/memory/sqlite.ts` (including automatic reset/backup on corruption)
- [X] T017 Ensure `~/.morpheus/memory` directory creation logic handles missing parent folders in `src/runtime/memory/sqlite.ts`

## Dependencies

- Phase 2 (Adapter) -> Phase 3 (Integration)
- Phase 3 (Integration) -> Phase 4 (Memory Management)

## Parallel Execution Opportunities

- T008 (Unit Tests) can be written in parallel with T003-T007 (Implementation).
- T013 and T015 (Integration Tests) can be prepared while T009-T012 are being implemented.
