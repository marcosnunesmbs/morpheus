# Implementation Tasks: Agent Interaction Flow

**Feature**: Agent Interaction Flow & Telegram Integration
**Spec**: [spec.md](spec.md)

## Phase 1: Setup & Data Model

- [x] T001 Update `MorpheusConfig` interface to include `TelegramConfig` in [src/types/config.ts](src/types/config.ts)
- [x] T002 Verify `ConfigManager` loads new config section correctly in [src/config/manager.ts](src/config/manager.ts)

## Phase 2: User Story 1 - Interactive Configuration

**Goal**: Enable users to configure Telegram settings during initialization.

- [x] T003 [US1] Import `confirm` and `checkbox` prompts in [src/cli/commands/init.ts](src/cli/commands/init.ts)
- [x] T004 [US1] Implement channel configuration flow in [src/cli/commands/init.ts](src/cli/commands/init.ts)
- [x] T005 [P] [US1] Implement Telegram specific prompt logic (Token, Allowed IDs) in [src/cli/commands/init.ts](src/cli/commands/init.ts)
- [x] T006 [US1] Ensure config saving includes new Telegram fields in [src/cli/commands/init.ts](src/cli/commands/init.ts)

## Phase 3: User Story 2 - Authorized Interaction Loop

**Goal**: Enable authorized users to chat with the agent via Telegram.

- [x] T007 [US2] Update `TelegramAdapter` constructor to accept `Agent` instance in [src/channels/telegram.ts](src/channels/telegram.ts)
- [x] T008 [US2] Update `TelegramAdapter.connect` to accept `allowedUsers` list in [src/channels/telegram.ts](src/channels/telegram.ts)
- [x] T009 [US2] Update `startCommand` to pass `agent` and `allowedUsers` to adapter in [src/cli/commands/start.ts](src/cli/commands/start.ts)
- [x] T010 [US2] Implement message listener with `agent.chat()` invocation in [src/channels/telegram.ts](src/channels/telegram.ts)
- [x] T011 [US2] Implement response sending via `ctx.reply()` in [src/channels/telegram.ts](src/channels/telegram.ts)

## Phase 4: User Story 3 - Unauthorized Access Control

**Goal**: Prevent unauthorized users from accessing the agent.

- [x] T012 [P] [US3] Implement `isAuthorized` helper method in [src/channels/telegram.ts](src/channels/telegram.ts)
- [x] T013 [US3] Add authorization check guard in message listener in [src/channels/telegram.ts](src/channels/telegram.ts)
- [x] T014 [P] [US3] Implement unauthorized access logging via `DisplayManager` in [src/channels/telegram.ts](src/channels/telegram.ts)

## Phase 5: User Story 4 - Error Feedback

**Goal**: Provide feedback when errors occur during processing.

- [x] T015 [US4] Wrap agent interaction in `try/catch` block in [src/channels/telegram.ts](src/channels/telegram.ts)
- [x] T016 [P] [US4] Implement user-friendly error reply to Telegram in [src/channels/telegram.ts](src/channels/telegram.ts)
- [x] T017 [P] [US4] Log interaction errors to `DisplayManager` in [src/channels/telegram.ts](src/channels/telegram.ts)

## Phase 6: Testing & Quality Assurance

**Goal**: Ensure core logic is covered by unit tests as per Constitution.

- [x] T018 Create test file for Telegram Adapter in [src/channels/__tests__/telegram.test.ts](src/channels/__tests__/telegram.test.ts)
- [x] T019 Implement unit tests for `TelegramAdapter` authorization logic (allowlist filtering) in [src/channels/__tests__/telegram.test.ts](src/channels/__tests__/telegram.test.ts)
- [x] T020 Implement unit tests for `ConfigManager` updates in [src/channels/__tests__/telegram.test.ts](src/channels/__tests__/telegram.test.ts)

## Dependencies

- US2 depends on T001 (types)
- US2 depends on T007 (adapter refactor)
- US3 depends on T010 (message listener existence)
- US4 depends on T010 (message listener existence)
- Phase 6 depends on completion of functional phases

## Implementation Strategy

1.  **Types**: Define the data model first.
2.  **CLI**: Enable the configuration flow so testing is easier (can `init` then `start`).
3.  **Adapter Refactor**: Change the signature of the adapter.
4.  **Wiring**: Update `start.ts` to wire them together.
5.  **Logic**: Implement the loop, auth, and error handling.
