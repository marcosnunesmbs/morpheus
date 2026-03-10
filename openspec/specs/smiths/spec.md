# Smiths Specification

## Purpose
Smith enables Oracle to delegate DevKit operations to remote isolated machines (Docker containers, VMs, cloud instances) over WebSocket. Each Smith instance runs a remote DevKit server and is managed by SmithRegistry.

## Scope
Included:
- SmithRegistry: connection management, hot-reload, state tracking
- SmithConnection: WebSocket client, authentication, heartbeat
- SmithDelegator: proxy tools, LangChain ReactAgent for remote execution
- smith_delegate tool: Oracle's delegation interface
- smith_manage and smith_list tools for runtime management
- Non-blocking startup: Smith connection failures do not block daemon boot

Out of scope:
- Oracle routing logic (covered in `oracle` and `subagents` specs)
- Task queue mechanics (covered in `tasks` spec)

## Requirements

### Requirement: Smith configuration
The system SHALL load Smith entries from `zaion.yaml` under `smiths.entries`, each requiring: name, host, port, and auth_token.

#### Scenario: Smiths disabled globally
- GIVEN `smiths.enabled` is false
- WHEN the daemon starts
- THEN no Smith connections are initiated and `smith_delegate` is not registered

#### Scenario: Smith entry registered
- GIVEN a valid Smith entry `{name: 'smith1', host: 'localhost', port: 7778}`
- WHEN the daemon starts
- THEN `SmithRegistry.register(entry)` is called and the Smith appears in `smith_list`

### Requirement: Non-blocking connection
The system SHALL connect to Smith instances asynchronously at startup; connection failures MUST NOT block daemon initialization.

#### Scenario: Smith unreachable at startup
- GIVEN a configured Smith is offline
- WHEN the daemon starts
- THEN the Smith is registered as `state: 'offline'` and other services start normally

### Requirement: Authentication
The system SHALL authenticate with each Smith via token handshake on connection. A 401 response (auth failure) MUST stop reconnection attempts.

#### Scenario: Successful auth
- GIVEN the Smith server expects token `secret-token`
- WHEN `SmithConnection` sends the handshake with the correct token
- THEN the connection is established and state becomes `online`

#### Scenario: Auth failure stops retries
- GIVEN the configured `auth_token` is incorrect
- WHEN the Smith server rejects the handshake with 401
- THEN `SmithConnection` sets `_authFailed = true` and no further reconnection is attempted

### Requirement: Reconnection
The system SHALL attempt reconnection up to 3 times on non-auth connection failures.

#### Scenario: Transient failure retried
- GIVEN a Smith goes offline due to a transient network error
- WHEN the connection drops
- THEN up to 3 reconnection attempts are made
- AND after 3 failures the Smith state is set to `offline` until a manual reconnect or hot-reload

### Requirement: Heartbeat
The system SHALL send periodic heartbeat messages to connected Smiths at the configured interval (default 30,000ms) to detect silent disconnections.

#### Scenario: Heartbeat detects disconnection
- GIVEN a Smith silently drops the WebSocket connection
- WHEN the next heartbeat fires and fails
- THEN the Smith state is updated to `offline`

### Requirement: Proxy tool execution
The system SHALL create a LangChain ReactAgent for Smith delegation that uses proxy DevKit tools — tools with the correct schema but whose execution is forwarded to the remote Smith over WebSocket.

#### Scenario: Tool forwarded to remote Smith
- GIVEN a task delegates `execShell "ls -la"` to Smith `smith1`
- WHEN SmithDelegator routes the execution
- THEN the tool call is serialized and sent to `smith1` over WebSocket
- AND the result is returned to Oracle

### Requirement: Hot-reload
The system SHALL support hot-reload of Smith config (via `PUT /api/smiths/config` or `smith_manage` tool), connecting new entries and disconnecting removed ones without restarting.

#### Scenario: New Smith added at runtime
- GIVEN a new Smith entry is added via `PUT /api/smiths/config`
- WHEN hot-reload runs
- THEN `SmithRegistry` connects to the new Smith

#### Scenario: Smith removed at runtime
- GIVEN a Smith entry is removed from config
- WHEN hot-reload runs
- THEN the connection is closed and the Smith is removed from the registry

### Requirement: Management tools
The system SHALL expose `smith_list` and `smith_manage` tools to Oracle for runtime Smith management.

#### Scenario: smith_list returns current state
- GIVEN 2 Smiths are registered, one online and one offline
- WHEN Oracle calls `smith_list`
- THEN both are returned with their current `state` and `capabilities`

#### Scenario: smith_manage ping
- GIVEN Smith `smith1` is online
- WHEN Oracle calls `smith_manage` with action `ping` and name `smith1`
- THEN the Smith responds and the latency is returned
