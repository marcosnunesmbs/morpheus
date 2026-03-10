# Tasks: LangChain Core Agent

**Spec**: [specs/004-langchain-core-agent/spec.md](specs/004-langchain-core-agent/spec.md)
**Plan**: [specs/004-langchain-core-agent/plan.md](specs/004-langchain-core-agent/plan.md)
**Branch**: `004-langchain-core-agent`

## Phase 1: Setup

- [x] T001 Install LangChain dependencies (`@langchain/core`, `@langchain/openai`, etc.) and `inquirer`
- [x] T002 Create directory `src/runtime/providers`
- [x] T003 Create directory `src/runtime/__tests__`

## Phase 2: Foundational

- [x] T004 [P] Define `IAgent` interface and `Session` type in `src/runtime/types.ts`
- [x] T005 [P] Define `ProviderError` class in `src/runtime/errors.ts`
- [x] T006 Update `ConfigSchema` in `src/config/schema.ts` (or create if missing) to include `llm` fields per data-model

## Phase 3: User Story 1 - Basic Message Processing

**Goal**: The agent can receive a message and return a response from a configured provider.

**Independent Test**: Create `manual_test_us1.ts` that mocks a config, instantiates Agent, and logs a response from OpenAI (requires env var).

- [x] T007 [US1] Implement `ProviderFactory` in `src/runtime/providers/factory.ts` to return `BaseChatModel` instances
- [x] T008 [US1] Create `Agent` class in `src/runtime/agent.ts` implementing `IAgent` (stateless for now)
- [x] T009 [US1] Implement `initialize()` in `Agent` to validate config and load provider
- [x] T010 [US1] Implement `chat()` in `Agent` to invoke model with simple prompt
- [x] T011 [US1] Create unit test `src/runtime/__tests__/agent.test.ts` for `Agent` class (mocking provider)

## Phase 4: User Story 2 - Contextual Conversation

**Goal**: The agent remembers previous messages in the session.

**Independent Test**: Extend `manual_test_us1.ts` to send two messages and verify context is maintained.

- [x] T012 [US2] Update `Agent` class to maintain `history: BaseMessage[]` property
- [x] T013 [US2] Update `chat()` method to pass history to model and append new messages
- [x] T014 [US2] Add test case to `src/runtime/__tests__/agent.test.ts` verifying history accumulation

## Phase 5: User Story 3 - Interactive Initialization (and Error Handling)

**Goal**: Users can easily create config and get helpful errors if it's wrong.

**Independent Test**: Run `npx . init` and verify `config.yaml` creation.

- [x] T015 [US3] Create `init` command in `src/cli/commands/init.ts` using `inquirer`
- [x] T016 [US3] Implement config writing logic in `src/cli/commands/init.ts` (ensure `.morpheus` dir exists)
- [x] T017 [US3] Register `init` command in `src/cli/index.ts`
- [x] T018 [US3] Update `src/cli/commands/start.ts` to validate config existence on launch (FR-008)
- [x] T019 [US3] Update `src/cli/commands/start.ts` to catch `ProviderError` and display helpful feedback (FR-009)

## Phase 6: Polish

- [x] T020 [P] specialized error messages for each provider (OpenAI 401 vs Ollama connection ref used)
- [x] T021 [P] Ensure strict typing for `llm.provider` enum in CLI prompts

## Dependencies

- **US1** depends on Foundational tasks.
- **US2** depends on US1.
- **US3** depends on valid `ConfigSchema` (Phase 2).
- **Start Command Updates (T018/T019)** depend on US1 and US3.

## Implementation Strategy

1.  **Skeleton**: Get the types and errors down.
2.  **Core Logic**: Build the `Agent` class to work with a hardcoded/mocked config first.
3.  **State**: Add memory to the agent.
4.  **CLI**: Build the `init` command to generate the real config.
5.  **Integration**: Wire up `start` to use the real Agent and real Config, with error handling.
