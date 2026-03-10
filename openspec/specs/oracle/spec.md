# Oracle Specification

## Purpose
Oracle is the root AI orchestrator. It receives user messages, maintains conversation history, and routes work to specialized subagents via delegation tools. It never executes DevKit or MCP tools directly.

## Scope
Included:
- Receiving and responding to chat messages
- Maintaining per-session conversation history (SQLite-backed)
- Building the ReactAgent with all delegation tools, MCP tools, and system tools
- Propagating session IDs to all subagents before each turn
- Refreshing subagent catalogs (dynamic tool descriptions) before each turn
- Integrating Sati long-term memory middleware
- Generating async acknowledgement messages when delegation tools are called
- Hot-reload of configuration without daemon restart

Out of scope:
- Direct execution of filesystem, shell, git, or database operations
- Channel-specific message parsing (handled by channel adapters)
- Task lifecycle management (handled by TaskWorker and TaskRepository)

## Requirements

### Requirement: Chat message processing
The system SHALL process every incoming message through a LangChain ReactAgent that has access to all registered subagent delegation tools, MCP tools, Chronos tools, time verifier, task query, and setup tools.

#### Scenario: Standard message routed to subagent
- GIVEN a user sends a message that requires filesystem operations
- WHEN Oracle processes the message
- THEN Oracle calls the `apoc_delegate` tool and returns an acknowledgement to the user
- AND the underlying task is enqueued for async execution

#### Scenario: Direct Oracle response
- GIVEN a user sends a conversational message that does not require delegation
- WHEN Oracle processes the message
- THEN Oracle responds directly without calling any delegation tool

### Requirement: Session history
The system SHALL maintain per-session message history backed by SQLite, scoped to the provided session ID.

#### Scenario: Continuing a session
- GIVEN an existing session with prior messages
- WHEN Oracle receives a new message with the same session ID
- THEN the full conversation history is loaded and included in the agent context

#### Scenario: New session
- GIVEN no prior history for a session ID
- WHEN Oracle receives the first message
- THEN it creates a new conversation history for that session

### Requirement: Session ID propagation
The system SHALL set the current session ID on all registered subagents (via SubagentRegistry) before processing each chat() call so delegation routes tasks to the correct session.

#### Scenario: Session propagated before agent run
- GIVEN Oracle is called with session ID `sess-abc`
- WHEN the agent run begins
- THEN all subagents have their session ID set to `sess-abc`

### Requirement: Dynamic catalog refresh
The system SHALL refresh dynamic tool descriptions (e.g., Neo's MCP catalog, Trinity's database list) before each chat() call so agents have up-to-date tool context.

#### Scenario: MCP catalog updated at runtime
- GIVEN a new MCP server was added since the last chat
- WHEN Oracle refreshes catalogs before the next chat
- THEN Neo's delegate tool description includes the new MCP server's tools

### Requirement: Sati memory integration
The system SHALL invoke the Sati memory middleware after each Oracle turn (configurable frequency) to evaluate and persist long-term memory from the conversation.

#### Scenario: Memory evaluation on configured turns
- GIVEN `sati.evaluation_frequency` is set to 5
- WHEN the 5th message in a session is processed
- THEN Sati evaluates the conversation and persists relevant memories

### Requirement: Smith registration
The system SHALL conditionally register the Smith remote agent in SubagentRegistry at initialization, only when Smiths are enabled and at least one entry is configured.

#### Scenario: Smiths disabled
- GIVEN `smiths.enabled` is false in config
- WHEN Oracle initializes
- THEN no `smith_delegate` tool is added to the agent

#### Scenario: Smiths enabled with entries
- GIVEN `smiths.enabled` is true and at least one Smith entry exists
- WHEN Oracle initializes
- THEN `smith_delegate` tool is available to the ReactAgent

### Requirement: Hot-reload
The system SHALL support reloading configuration, subagents, and tools at runtime via a `reload()` call without restarting the daemon.

#### Scenario: Config changed at runtime
- GIVEN the user updates a provider or subagent setting
- WHEN `oracle.reload()` is called
- THEN the new configuration is applied to all subagents and the ReactAgent is rebuilt
