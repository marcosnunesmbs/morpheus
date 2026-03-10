# Tasks: Database Message Persistence for Provider and Model

**Branch**: `021-db-msg-provider-model` | **Date**: 2026-02-02 | **Spec**: [specs/021-db-msg-provider-model/spec.md](specs/021-db-msg-provider-model/spec.md)
**Input**: Plan from [specs/021-db-msg-provider-model/plan.md](specs/021-db-msg-provider-model/plan.md)

## Phase 1: Setup

*Project verification and preparation.*

- [x] T001 Verify `src/runtime/memory/sqlite.ts` and `src/runtime/agent.ts` structure matches expectations

## Phase 2: Foundational

*Blocking prerequisites for all user stories.*

- [x] T002 Define `MessageProviderMetadata` interface or type strategy in `src/runtime/memory/sqlite.ts` comments for reference

## Phase 3: User Story 2 - Database Schema Migration

*As a system administrator, I want the database schema to automatically update...*

- [x] T003 [US2] Update `migrateTable` in `src/runtime/memory/sqlite.ts` to add `provider` and `model` columns (TEXT)
- [x] T004 [US2] Verify `ensureTable` call flow ensures migration runs after table creation in `src/runtime/memory/sqlite.ts`

## Phase 4: User Story 1 - Message Metadata Persistence

*As a developer/analyst, I want new chat messages to be stored with the AI provider...*

- [x] T005 [US1] Update `addMessage` signature or logic in `src/runtime/memory/sqlite.ts` to extract `provider`/`model` from message object and INSERT into DB
- [x] T006 [US1] Update `getMessages` in `src/runtime/memory/sqlite.ts` to SELECT `provider`/`model` and attach to returned BaseMessage objects
- [x] T007 [US1] Update `Agent.chat` in `src/runtime/agent.ts` to inject `this.config.llm.provider` and `model` metadata into user and AI messages before saving

## Phase 5: Polish & Cross-Cutting Concerns

*Final validation and cleanup.*

- [x] T008 Manual verification: Start app, send message, query SQLite DB to verify columns are populated

## Dependencies

- **US1 depends on US2**: Cannot persist metadata (US1) until columns exist (US2).
- T005 and T006 depend on T003.

## Implementation Strategy

1. **Schema First**: Implement the migration logic in `sqlite.ts`. This allows the app to start without crashing even if persistence logic isn't there yet.
2. **Persistence Layer**: Update `addMessage`/`getMessages` to handle the new columns.
3. **Application Layer**: Finally, update `Agent.chat` to start feeding the data down to the persistence layer.
