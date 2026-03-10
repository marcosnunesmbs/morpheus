# Smith Agent — Remote Execution Nodes

## Overview
Smith is a lightweight remote agent that runs on external machines and acts as an extension of Morpheus. It receives task payloads from Morpheus (via Oracle's `smith_delegate` tool), executes them locally using a subset of DevKit tools, and streams results back.

## Terminology
- **Smith**: A remote agent process running on an external machine
- **SmithRegistry**: Morpheus-side singleton that tracks connected Smiths
- **Mothership**: The Morpheus instance that controls Smiths

## User Stories

### US-01: Register a Smith
As a user, I want to register a remote machine as a Smith so Morpheus can delegate tasks to it.
- Configure via `zaion.yaml` under `smiths:` section
- Each Smith entry has: `name`, `host`, `port`, `auth_token`
- Also configurable via Settings UI → Smiths tab

### US-02: Delegate task to a Smith
As a user, I want Oracle to delegate tasks to a specific Smith when I ask it to run something on a remote machine.
- Oracle uses `smith_delegate` tool with `{ smith: "name", task: "description" }`
- Supports both `sync` and `async` execution modes (like other subagents)

### US-03: Smith auto-discovery
As a user, I want Smiths to announce themselves to Morpheus on startup so I don't have to manually configure IPs.
- Smith sends a registration handshake to Morpheus HTTP API on boot
- Morpheus validates auth token and adds to SmithRegistry

### US-04: Smith health monitoring
As a user, I want to see which Smiths are online and their system stats.
- Heartbeat every 30s (configurable)
- Status visible in Settings UI → Smiths tab
- Oracle knows which Smiths are available via system prompt injection

### US-05: Smith security
As a user, I want each Smith to enforce its own sandbox/security policy independently.
- Smith has its own `devkit` config (sandbox_dir, readonly_mode, allowlists)
- Morpheus cannot override Smith's local security policy
- All communication authenticated via shared secret or mTLS

### US-06: Smith execution
As a user, I want Smiths to execute filesystem, shell, git, and system commands on the remote machine.
- Smith runs a subset of DevKit tools locally
- Results streamed back to Morpheus in real-time
- Errors and timeouts handled gracefully

## Acceptance Criteria

### AC-01: Registration
- [ ] Smith can be configured in `zaion.yaml` under `smiths[]`
- [ ] Smith can self-register via HTTP handshake
- [ ] Duplicate names are rejected
- [ ] Invalid auth tokens are rejected with 401

### AC-02: Delegation
- [ ] `smith_delegate` tool available to Oracle
- [ ] Sync mode: Oracle waits for result inline
- [ ] Async mode: Task queued, result delivered via TaskNotifier
- [ ] Unknown Smith name returns descriptive error

### AC-03: Communication
- [ ] WebSocket connection between Morpheus ↔ Smith
- [ ] Automatic reconnection with exponential backoff
- [ ] Heartbeat keeps connection alive
- [ ] Connection timeout configurable

### AC-04: Security
- [ ] Auth token validated on every request
- [ ] Smith enforces local sandbox_dir independently
- [ ] No remote code execution without auth
- [ ] Smith can reject tasks that violate its policy

### AC-05: Observability
- [ ] Smith status (online/offline/error) visible in UI
- [ ] System stats (CPU, RAM, OS) reported in heartbeat
- [ ] Verbose mode sends `🔧 smith:<name> executing: <tool>` notifications
- [ ] Smith logs accessible via API

## Non-Goals (v1)
- Smith-to-Smith communication (only Morpheus → Smith)
- Load balancing across Smiths
- Smith auto-update mechanism
- File transfer between Morpheus and Smith (future)
- Smith running its own LLM (it's a tool executor, not an agent)

## Architecture Diagram

```
┌─────────────────────────────────────────────┐
│                 MORPHEUS                     │
│                                             │
│  Oracle ──smith_delegate──► SmithRegistry   │
│                                │            │
│                    ┌───────────┼──────────┐ │
│                    ▼           ▼          ▼ │
│              Smith-A      Smith-B    Smith-C│
│              (WS/HTTP)    (WS/HTTP)  (WS)  │
└──────────────┬─────────────┬─────────┬──────┘
               │             │         │
        ┌──────▼──┐   ┌─────▼───┐  ┌──▼──────┐
        │ Machine │   │ Machine │  │ Machine  │
        │   A     │   │ DevKit  │  │   C      │
        │ DevKit  │   │ subset  │  │ DevKit   │
        │ subset  │   │         │  │ subset   │
        └─────────┘   └─────────┘  └──────────┘
```

## Wire Protocol (Smith ↔ Morpheus)

All messages are JSON over WebSocket:

```typescript
// Morpheus → Smith
{ type: 'task', id: string, payload: { tool: string, args: Record<string, any> } }
{ type: 'ping' }
{ type: 'config_query' }

// Smith → Morpheus
{ type: 'task_result', id: string, result: { success: boolean, data: any, error?: string } }
{ type: 'task_progress', id: string, progress: { message: string, percent?: number } }
{ type: 'pong', stats: { cpu: number, memory: number, os: string, uptime: number } }
{ type: 'register', name: string, auth_token: string, capabilities: string[] }
{ type: 'config_report', devkit: DevKitConfig }
```
