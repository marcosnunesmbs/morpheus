# Tasks: Integrate LangChain Agent with CLI Start

**Feature Branch**: `005-langchain-agent-integration`
**Feature Name**: Integrate LangChain Agent with CLI Start

## Phase 1: Setup
*Preparation and environment verification*

- [x] T001 Create verification script `src/runtime/__tests__/manual_start_verify.ts` to test agent initialization isolation and measure startup time (< 5s)

## Phase 2: Foundational (Orchestrator Core)
*Enhancing the Agent class to act as a robust Orchestrator (User Story 2)*

- [x] T002 [US2] Update `src/runtime/agent.ts` to ensure `initialize()` validates configuration presence
- [x] T003 [US2] update `src/runtime/providers/factory.ts` to throw distinct error types for missing API keys vs connection errors
- [x] T004 [US2] Add unit tests for Agent configuration validation in `src/runtime/__tests__/agent.test.ts`

## Phase 3: Start Command Integration (User Story 1)
*Wiring the Orchestrator into the CLI lifecycle*

- [x] T005 [US1] Update `src/cli/commands/start.ts` to perform pre-flight config checks before Agent instantiation
- [x] T006 [US1] Modify `src/cli/commands/start.ts` to catch `ProviderError` specifically and display actionable suggestions
- [x] T007 [US1] Enhance `src/cli/commands/start.ts` graceful shutdown to ensure Agent resources are released

## Phase 4: Polish & Verification
*Final checks and cleanup*

- [x] T008 Run `manual_start_verify.ts` and verify success output
- [x] T009 Run `morpheus start` with valid config and verify initialization
- [x] T010 Run `morpheus start` with invalid config/missing key and verify error message

## Dependencies

- **US2 (Config/Orchestrator)** must be stable before **US1 (CLI)** can be fully verified.

## Implementation Strategy

1.  **Orchestrator First**: Harden the `Agent` class and `ProviderFactory` first (T002, T003). This allows unit testing without running the full CLI.
2.  **CLI Integration**: Once `Agent` is robust, wire it into `start.ts` (T005, T006) and handle the lifecycle events (T007).
3.  **Verification**: Use the manual script to verify the logic before running the full immutable CLI command.
