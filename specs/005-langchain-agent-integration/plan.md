# Implementation Plan - Integrate LangChain Agent with CLI Start

**Feature Branch**: `005-langchain-agent-integration`
**Status**: DRAFT

## Technical Context

The `start` command is the entry point for the Morpheus runtime. Previous features have established the `Agent` class (integrated with LangChain), `ConfigManager`, and `ProviderFactory`. This feature focuses on wiring these components together ensuring the `start` command correctly initializes the agent using the user's configuration.

**Existing Components:**
- **Agent Class (Orchestrator)** (`src/runtime/agent.ts`): Implements `initialize()` and `chat()` using `ProviderFactory`.
- **Start Command** (`src/cli/commands/start.ts`): Contains boilerplate for config loading, PID management, and Agent initialization.
- **Config Manager** (`src/config/manager.js`): Handles YAML config loading.
- **Provider Factory** (`src/runtime/providers/factory.ts`): Instantiates LangChain models.

**Analysis of Current State (post-merge):**
The `start.ts` file already contains calls to `new Agent(config)` and `agent.initialize()`. It appears the implementation from `004` (Agent Core) was heavily intertwined with `start`. This plan will focus on **verification**, **error handling refinement**, and **ensuring correct dependency injection** of configurations, rather than writing the integration from scratch if it already exists.

## Constitution Check

- [x] **Local-First**: Configs and keys are loaded from local files.
- [x] **Extensibility**: Uses `ProviderFactory` which can be extended.
- [x] **DX**: `start` handles errors and PID management explicitly.

## Requirements Gates

- [x] **Security**: API keys are loaded from safe storage (config file/env).
- [x] **Performance**: Initialization happens async; heavy lifting deferred to `initialize()`.
- [x] **Reliability**: Graceful shutdown handles implemented.

## Phase 0: Research & Verification

**Goal**: Confirm the current implementation meets the spec and identify any gaps.

- [ ] **Task**: Review `src/runtime/agent.ts` to ensure it passes `config.llm` correctly to `ProviderFactory`.
- [ ] **Task**: Verify `src/cli/commands/start.ts` handles `ProviderError` specifically (it seems to, but verify types).
- [ ] **Task**: **[NEEDS CLARIFICATION]** Does the user expect to chat via the terminal (stdin) if no other channels are active? The current `start.ts` starts a spinner but blocks stdin.
- [ ] **Task**: Create a `manual_start_verify.ts` script or instructions to test `start` with a real (or mock) API key.

## Phase 1: Implementation / Refinement

**Goal**: Polish the code to strictly meet Acceptance Criteria.

### Data Model & Contracts
- *No changes to Data Model anticipated (Config schema exists).*
- *CLI Contract*: `morpheus start` output format (banners, logs) is already established but will be reviewed for clarity.

### Execution Steps
1.  **Build Orchestrator (Agent Class)**:
    -   Enhance `src/runtime/agent.ts` to be a true Orchestrator.
    -   Implement robustness: Handle "Brain" (Provider) initialization failures gracefully.
    -   Prepare internal state for future Tool augmentation.
2.  **Refine Error Handling**: Ensure `ProviderError` from `agent.initialize()` propagates up to `start` with user-friendly messages (e.g. "Invalid API Key").
3.  **Configuration Validation**: Verify `ConfigManager` throws/warns if critical LLM fields are missing before Agent Init.
3.  **Interactive Mode (Optional)**: If decided, implement a simple REPL in `start.ts` if `--interactive` flag is present or default behavior. *Decision deferred to Research.*

### Agent Context Update
- Run agent update script to reflect `start` command capabilities.
