# Subagents Specification

## Purpose
Subagents are specialized AI agents that Oracle delegates work to. Each subagent has a domain expertise (filesystem, databases, MCP tools, documents, remote execution). The SubagentRegistry is the single source of truth for registration, delegation tools, display metadata, session propagation, and task routing.

## Scope
Included:
- SubagentRegistry — register, get, list, route tasks, propagate sessions
- ISubagent contract — initialize, execute, reload, createDelegateTool
- Local subagents: Apoc (DevKit/shell), Trinity (databases), Neo (MCP), Link (RAG)
- Execution modes: sync (inline) and async (task queue)
- Verbose mode — real-time tool execution notifications

Out of scope:
- Smith (remote agent) — covered in `smiths` spec
- Task queue mechanics — covered in `tasks` spec
- DevKit security sandbox — covered in `devkit` spec

## Requirements

### Requirement: Subagent registration
The system SHALL allow subagents to self-register with SubagentRegistry during `getInstance()`, providing a unique `agentKey`, delegation tool name, display metadata, and instance reference.

#### Scenario: Successful registration
- GIVEN a subagent class calls `SubagentRegistry.register(reg)` in `getInstance()`
- WHEN Oracle initializes and calls `getInstance()` for each subagent
- THEN the subagent is available via `SubagentRegistry.get(agentKey)`
- AND its delegation tool is included in `SubagentRegistry.getDelegationTools()`

#### Scenario: Duplicate registration prevention (Smith)
- GIVEN Smith is already registered in SubagentRegistry
- WHEN Oracle calls `registerSmithIfEnabled()` again
- THEN the duplicate registration is skipped

### Requirement: Task routing via registry
The system SHALL route background tasks to the correct subagent by looking up `task.agent` in SubagentRegistry, without per-agent switch/case logic in TaskWorker.

#### Scenario: Task dispatched to Apoc
- GIVEN a task record with `agent = 'apoc'` is pending in the queue
- WHEN TaskWorker picks it up
- THEN `SubagentRegistry.executeTask(task)` routes it to `Apoc.getInstance().execute()`

#### Scenario: Unknown agent
- GIVEN a task record with `agent = 'unknown_agent'`
- WHEN TaskWorker attempts to execute it
- THEN `SubagentRegistry.executeTask()` throws `Error('Unknown task agent: unknown_agent')`

### Requirement: Execution modes
The system SHALL support two execution modes per subagent, configurable via `zaion.yaml` or environment variable:
- **async** (default): Oracle enqueues a background task and returns an acknowledgement immediately.
- **sync**: Oracle executes the subagent inline and returns the result directly.

#### Scenario: Async delegation
- GIVEN `apoc.execution_mode` is `async`
- WHEN Oracle calls `apoc_delegate`
- THEN a task is created in the queue and Oracle returns a task acknowledgement string

#### Scenario: Sync delegation
- GIVEN `neo.execution_mode` is `sync`
- WHEN Oracle calls `neo_delegate`
- THEN Neo executes immediately and Oracle receives the result inline in the same turn

### Requirement: Session ID propagation
The system SHALL propagate the current session ID to all registered subagents before each Oracle turn via `SubagentRegistry.setAllSessionIds(sessionId)`.

#### Scenario: Session set on all subagents
- GIVEN Apoc, Trinity, Neo, and Link are all registered
- WHEN Oracle is called with session ID `sess-xyz`
- THEN all four subagents have their static `currentSessionId` set to `sess-xyz`

### Requirement: Display metadata
The system SHALL expose display metadata (emoji, color, label, CSS classes) for all agents — both subagents and system agents (Oracle, Chronos, Sati, Telephonist) — via `SubagentRegistry.getDisplayMetadata()`.

#### Scenario: Agents API returns all metadata
- GIVEN Oracle, Apoc, Trinity, Neo, Link, and Smith are registered
- WHEN `GET /api/agents/metadata` is called
- THEN the response includes all subagents plus system agents (oracle, chronos, sati, telephonist)

### Requirement: Verbose mode
The system SHALL send real-time tool execution notifications (`executing: <tool_name>`) to the originating channel when `verbose_mode` is enabled, for every tool call made by any subagent.

#### Scenario: Verbose notification sent
- GIVEN `verbose_mode` is true and origin channel is `telegram`
- WHEN Apoc executes a DevKit tool
- THEN a notification is sent to the Telegram channel with the tool name

#### Scenario: Verbose suppressed for API/UI channels
- GIVEN `verbose_mode` is true and origin channel is `api` or `ui`
- WHEN a tool is executed
- THEN no verbose notification is sent

### Requirement: Dynamic description refresh
The system SHALL support subagents with dynamic tool descriptions (e.g., Neo listing available MCP tools, Trinity listing registered databases) that are refreshed before each Oracle turn.

#### Scenario: Neo catalog refreshed
- GIVEN a new MCP tool was registered since the last turn
- WHEN Oracle calls `SubagentRegistry.refreshAllCatalogs()`
- THEN Neo's `neo_delegate` tool description is updated to include the new tool

### Requirement: Apoc — DevKit execution
The system SHALL have Apoc execute DevKit tools (filesystem, shell, git, network, packages, processes, system, browser) within the configured security sandbox.

#### Scenario: Shell command executed
- GIVEN a task delegates a shell command to Apoc
- WHEN Apoc runs its ReactAgent
- THEN it uses the `execShell` DevKit tool within `devkit.sandbox_dir`

### Requirement: Trinity — database operations
The system SHALL have Trinity connect to registered databases (PostgreSQL, MySQL, SQLite, MongoDB) and execute queries as directed.

#### Scenario: SQL query executed
- GIVEN a task delegates a query to Trinity for a registered PostgreSQL database
- WHEN Trinity runs its ReactAgent
- THEN it connects to the database and returns the query result

### Requirement: Neo — MCP tool orchestration
The system SHALL have Neo execute MCP tools discovered from configured MCP servers.

#### Scenario: MCP tool called
- GIVEN an MCP server is configured and connected
- WHEN a task delegates to Neo to call an MCP tool
- THEN Neo's ReactAgent calls the tool and returns the result

### Requirement: Link — document RAG
The system SHALL have Link search indexed documents using hybrid vector + keyword search and return relevant content.

#### Scenario: Document search
- GIVEN documents have been indexed in the Link database
- WHEN a task delegates a document search to Link
- THEN Link returns the most relevant document chunks matching the query
