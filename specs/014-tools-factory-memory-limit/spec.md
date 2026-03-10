# Feature Specification: Refactor Tools Factory & Memory Config

**Feature Branch**: `014-tools-factory-memory-limit`  
**Created**: 2026-01-31  
**Status**: Draft  
**Input**: User description: "vamos pegar a informação de limite de mensagens anexadas em cada iteração. esse dado deve ficar no arquivo de config, não precisa perguntar no init, mas o crie com o valor 100. além disso vamos organizar a factory para criar o client MultiServerMCPClient em outra factory de tools."

## User Scenarios & Testing

### User Story 1 - Configurable Context Memory Limit (Priority: P1)

The user wants to control how many past messages are included in the context window sent to the LLM, to manage costs or context window limits, without recompiling the code.

**Why this priority**: Essential to avoid context overview errors and manage token usage, as requested by the user.

**Independent Test**: Can be tested by changing the config value and verifying the number of messages loaded by the Agent.

**Acceptance Scenarios**:

1.  **Given** a new installation, **When** the configuration is initialized, **Then** the config file should contain a memory limit setting with a default value of 100.
2.  **Given** an existing configuration, **When** the user manually edits the `memory_limit` to 50, **Then** the Agent should only recall the last 50 messages during a conversation.
3.  **Given** the initialization flow (`npm start -- init`), **When** running, **Then** the user is NOT asked to input the memory limit interactively (it uses the default).

---

### User Story 2 - Modular Tools Architecture (Priority: P2)

As a developer, I want the tool creation logic separated from the LLM provider logic so that I can maintain and extend tool capabilities more easily.

**Why this priority**: Improves code maintainability and separation of concerns as requested.

**Independent Test**: Can be verified by code inspection and ensuring the Agent still has access to tools (e.g., CoinGecko) after refactoring.

**Acceptance Scenarios**:

1.  **Given** the Agent startup, **When** initializing the LLM provider, **Then** the tools should be created via a dedicated `ToolsFactory` or similar mechanism, not directly inside `ProviderFactory`.
2.  **Given** the refactored code, **When** running a command that requires an MCP tool (e.g., price check), **Then** the tool executes successfully.

### Edge Cases

-   **Invalid Config Value**: If `memory_limit` is set to a non-number or negative value, the system should fallback to the default (100) or throw a clear verification error.
-   **No Tools Configured**: If `ToolsFactory` fails to initialize tools, the Agent should probably continue without tools (or fail if tools are critical - assumption: continue with warning).

## Requirements

### Functional Requirements

-   **FR-001**: System MUST include a configuration setting for message history limit (e.g., `memory_limit`).
-   **FR-002**: The default value for `memory_limit` MUST be 100.
-   **FR-003**: The initialization command (`morpheus init`) MUST write this default value to the config file without prompting the user.
-   **FR-004**: The Agent MUST read `memory_limit` from the configuration at runtime.
-   **FR-005**: The Agent's memory persistence layer (SQLite) MUST use the configured `memory_limit` to restrict the number of retrieved messages.
-   **FR-006**: The creation of `MultiServerMCPClient` (and other tools) MUST be moved to a dedicated factory class/module (e.g., `ToolsFactory`).
-   **FR-007**: The `ProviderFactory` MUST accept tools or retrieve them from `ToolsFactory` rather than instantiating the MCP client directly.

### Key Entities

-   **Config**: Updated schema to include `memory_limit` (integer).
-   **ToolsFactory**: New entity responsible for initializing MCP clients and tools.

## Success Criteria

### Measurable Outcomes

-   **SC-001**: A newly generated `config.yaml` contains `memory_limit: 100`.
-   **SC-002**: Agent creates `SQLiteChatMessageHistory` with the `limit` matching the config value.
-   **SC-003**: `ProviderFactory` class no longer imports or directly instantiates `MultiServerMCPClient`.
-   **SC-004**: Agent successfully performs a task using an MCP tool after refactoring.
