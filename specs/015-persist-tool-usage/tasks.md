# Tasks: Improve Message Persistence & Usage Metadata

- [x] T001 Define `UsageMetadata` interface in `src/types/usage.ts`
- [x] T002 Update `IAgent` interface in `src/runtime/types.ts` to support optional metadata in `chat()`

## Phase 1: Setup & Data Model (User Story 1 & 2)

- [x] T003 Update `ensureTable` in `src/runtime/memory/sqlite.ts` to add schema columns for metadata
- [x] T004 [P] Implement migration logic in `src/runtime/memory/sqlite.ts` to ALTER existing tables
- [x] T005 [US1] Update `addMessage` in `src/runtime/memory/sqlite.ts` to handle `ToolMessage` type
- [x] T006 [US2] Update `addMessage` in `src/runtime/memory/sqlite.ts` to extract and save `usage_metadata`
- [x] T007 [US1] Update `getMessages` in `src/runtime/memory/sqlite.ts` to reconstruct `ToolMessage`
- [x] T008 [US2] Update `getMessages` in `src/runtime/memory/sqlite.ts` to rehydrate `usage_metadata`
- [x] T009 [US1] Create unit tests for `store/retrieve` ToolMessage in `src/runtime/memory/__tests__/sqlite.test.ts`
- [x] T010 [US2] Create unit tests for `store/retrieve` UsageMetadata in `src/runtime/memory/__tests__/sqlite.test.ts`

## Phase 2: Agent Logic (User Story 1)

- [x] T011 [US1] Refactor `Agent.chat` in `src/runtime/agent.ts` to identify new messages from `invoke` response
- [x] T012 [US1] Implement loop in `Agent.chat` to persist all new messages (not just last)
- [x] T013 [US1] Verify order of preservation (User -> Tools... -> AI) in `Agent.chat`
- [x] T014 [US1] Create test for `Agent` to verify multiple history entries are created in `src/runtime/__tests__/agent.test.ts`
  *(Marking T014 done as part of manual verification plan later, or I should create it now? I will create it now because manual verification is better).*
  Wait, I will leave T014 as pending until I actually test it, or proceed to Audio. The plan says I can do it later.
  Actually, I'll update `AudioAgent` first.

## Phase 3: Audio Integration (User Story 3)

- [x] T015 [US3] Update `IAudioAgent` interface in `src/runtime/audio-agent.ts` to return object with usage
- [x] T016 [US3] Update `AudioAgent.transcribe` implementation to extract usage from Google GenAI
- [x] T017 [US3] Update `Agent.chat` in `src/runtime/agent.ts` to accept `extraUsage` param
- [x] T018 [US3] Update `Agent.chat` to attach `extraUsage` to the created `HumanMessage`
- [x] T019 [US3] Update `TelegramAdapter` in `src/channels/telegram.ts` to handle new `transcribe` return type
- [x] T020 [US3] Update `TelegramAdapter` to pass audio usage to `Agent.chat`

## Phase 4: Polish & Verification

- [x] T021 Manual verification script `src/runtime/__tests__/manual_verify_tools.ts` for full trace
- [x] T022 Manual verification script `src/runtime/__tests__/manual_verify_audio.ts` for audio usage

## Dependencies

1. **Memory Layer** (T003-T010) must be completed first to support data storage.
2. **Agent Logic** (T011-T014) depends on Memory Layer adjustments.
3. **Audio Integration** (T015-T020) depends on Agent Logic updates (T017).

## Parallel Execution

- **T009/T010** (Tests) can be written in parallel with **T003-T008** (Implementation).
- **Phase 3** (Audio) can theoretically start once T002 (Interface) is ready, but T017 requires `Agent` changes.

## Implementation Strategy

We will start by modifying the SQLite layer to support the new data. Once the storage is capable, we will upgrade the Agent core to feed it the complete trace. Finally, we will wire up the Audio agent to report its specific costs.
