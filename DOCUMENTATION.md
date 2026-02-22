<div align="center">
  <img src="./assets/logo.png" alt="Morpheus Logo" width="220" />
</div>

# Morpheus Documentation

## 1. Overview
Morpheus is a local-first AI operator that runs as a daemon and coordinates:
- conversation orchestration (Oracle)
- asynchronous delegated execution (Neo/Apoc)
- long-term memory (Sati)
- local persistence (SQLite)
- multi-channel delivery (UI, Telegram, API, webhooks)

This document reflects the current runtime behavior and API contracts.

## 2. Runtime Architecture

### 2.1 Agents

| Agent | Role | Main Tool Scope |
|---|---|---|
| Oracle (`src/runtime/oracle.ts`) | Orchestrator and router | `task_query`, `neo_delegate`, `apoc_delegate`, `trinity_delegate` |
| Neo (`src/runtime/neo.ts`) | MCP + internal operational execution | MCP tools + config/diagnostic/analytics tools |
| Apoc (`src/runtime/apoc.ts`) | DevTools and browser executor | DevKit tools |
| Trinity (`src/runtime/trinity.ts`) | Database specialist | PostgreSQL/MySQL/SQLite/MongoDB execution + schema introspection |
| Sati (`src/runtime/memory/sati/*`) | Long-term memory retrieval/evaluation | Memory-only reasoning |

### 2.2 Delegation Rules
Oracle behavior:
- direct answer only for conversation-only requests
- execution requests are delegated asynchronously
- multi-action requests are split into multiple atomic tasks
- each delegated task has a single objective
- task status inquiries are handled through `task_query`

### 2.3 Delegation Safety Guards
- non-atomic delegation text is rejected
- same-turn duplicate delegation is deduplicated
- per-turn delegation cap is enforced
- Oracle validates task IDs in DB before acknowledging creation
- synthetic/fabricated "task created" responses are blocked

## 3. Async Task Subsystem

### 3.1 Components
- `TaskRepository` (`src/runtime/tasks/repository.ts`): queue persistence and state transitions
- `TaskWorker` (`src/runtime/tasks/worker.ts`): claims and executes pending tasks
- `TaskNotifier` (`src/runtime/tasks/notifier.ts`): sends completion/failure notifications
- `TaskDispatcher` (`src/runtime/tasks/dispatcher.ts`): channel-specific delivery
- `TaskRequestContext` (`src/runtime/tasks/context.ts`): async-local origin/session/delegation context

### 3.2 Task Lifecycle
Execution lifecycle:
- `pending -> running -> completed|failed`

Notification lifecycle:
- `pending -> sending -> sent|failed`

### 3.3 Reliability
- retry with exponential backoff
- stale running recovery
- stale notification recovery
- small notification grace window to reduce race conditions

## 4. Memory and Usage Persistence

### 4.1 Short-Term Memory
`short-memory.db` stores messages by session with:
- `type`, `content`, `created_at`
- token columns: `input_tokens`, `output_tokens`, `total_tokens`, `cache_read_tokens`
- model provenance: `provider`, `model`
- `audio_duration_seconds`

### 4.2 Long-Term Memory (Sati)
`SatiMemoryMiddleware`:
- before Oracle: retrieves relevant memories
- after non-delegation turns: evaluates and persists durable memory facts

### 4.3 Usage Tracking
- Oracle persists user and AI messages, including delegation acknowledgements
- Neo and Apoc persist delegated task outputs with usage metadata
- UI renders message-level token badges using persisted usage data

## 5. Telegram Channel Behavior

### 5.1 Rendering
Telegram outbound messages use HTML parse mode with conversion layer:
- markdown-like bold/italic/list rendering
- inline and fenced code support
- UUID auto-wrapped in `<code>` for easier copy

### 5.2 Proactive Task Notifications
Task completion/failure notifications include:
- task id
- agent
- status
- output or error body

### 5.3 Commands
- `/start`
- `/status`
- `/doctor`
- `/stats`
- `/help`
- `/zaion`
- `/sati <qnt>`
- `/newsession`
- `/sessions`
- `/restart`
- `/mcpreload`
- `/mcp` or `/mcps`
- `/trinity` — list registered Trinity databases with inline test/refresh-schema/delete actions
- `/chronos <prompt> @ <schedule>` — create a new scheduled job (e.g. `/chronos check bitcoin price @ every day at 9am`)
- `/chronos_list` — list all jobs with 🟢 active / 🔴 disabled status indicators
- `/chronos_view <id>` — view job details and last 5 executions
- `/chronos_enable <id>` — re-enable a disabled job (recomputes next run)
- `/chronos_disable <id>` — pause a job without deleting it
- `/chronos_delete <id>` — delete a job (asks for confirmation)

## 6. Web UI Behavior

### 6.1 Chat
- session-based conversation
- AI markdown rendering
- tool messages in collapsible blocks
- SATI traces grouped as `SATI Memory`
- per-message token badge (input/output)

### 6.2 Tasks Page
- live polling for queue and stats
- filters by status, agent, channel, session
- details modal
- retry for failed tasks

### 6.3 Settings
Dedicated agent tabs:
- Oracle
- Sati
- Neo
- Apoc
- Trinity

### 6.4 Trinity Databases Page
- Register databases (PostgreSQL, MySQL, SQLite, MongoDB)
- Test connection
- Refresh schema (re-introspect database structure)
- Per-database permissions: `allow_read`, `allow_insert`, `allow_update`, `allow_delete`, `allow_ddl`
- Passwords encrypted at rest (AES-256-GCM)

### 6.5 Chronos Page
- Job table showing all scheduled jobs (active and disabled)
- Create job modal: prompt, schedule expression (natural language or cron), timezone
- Edit existing job (prompt and schedule)
- Execution history drawer per job (status, triggered_at, duration)
- Enable/disable/delete actions with confirmation dialog

## 7. Configuration

Config file: `~/.morpheus/zaion.yaml`

```yaml
agent:
  name: morpheus
  personality: helpful_dev

llm:
  provider: openai
  model: gpt-4o
  temperature: 0.7
  context_window: 100

sati:
  provider: openai
  model: gpt-4o-mini
  temperature: 0.3
  memory_limit: 100
  enabled_archived_sessions: true

neo:
  provider: openai
  model: gpt-4o-mini
  temperature: 0.2

apoc:
  provider: openai
  model: gpt-4o-mini
  temperature: 0.2
  working_dir: /home/user/projects
  timeout_ms: 30000

trinity:
  provider: openai
  model: gpt-4o-mini
  temperature: 0.2

chronos:
  check_interval_ms: 60000   # polling interval (minimum 60000)
  default_timezone: UTC      # IANA timezone used when none is specified

runtime:
  async_tasks:
    enabled: true

channels:
  telegram:
    enabled: false
    token: env:TELEGRAM_BOT_TOKEN
    allowedUsers: []
  discord:
    enabled: false

ui:
  enabled: true
  port: 3333

audio:
  enabled: true
  provider: google
  model: gemini-2.5-flash-lite
  maxDurationSeconds: 300

logging:
  enabled: true
  level: info
  retention: 14d
```

## 8. API Reference (Complete Payloads and Response Examples)

## 8.1 Common Rules
- Base URL: `http://localhost:3333`
- Protected endpoints require header:
  - `x-architect-pass: <THE_ARCHITECT_PASS>`
- Common auth error for protected endpoints:

```json
{
  "error": "Unauthorized",
  "code": "UNAUTHORIZED"
}
```

- Common server error shape:

```json
{
  "error": "<message>"
}
```

## 8.2 Public Health Endpoints

### GET `/health`
Request payload:
- No body

Success response `200`:

```json
{
  "status": "healthy",
  "timestamp": "2026-02-20T15:10:22.123Z",
  "uptime": 1832.55
}
```

### GET `/api/health`
Request payload:
- No body

Success response `200`:

```json
{
  "status": "healthy",
  "timestamp": "2026-02-20T15:10:22.123Z",
  "uptime": 1832.55
}
```

## 8.3 Sessions and Chat (Protected)

### GET `/api/sessions`
Request payload:
- No body

Success response `200`:

```json
[
  {
    "id": "d18e23e6-67db-4ec1-b614-95eeaf399827",
    "title": "Bitcoin and Network Checks",
    "status": "active",
    "started_at": 1771558000000
  },
  {
    "id": "a88a2f44-86f4-44a6-9629-89ca5441f273",
    "title": null,
    "status": "paused",
    "started_at": 1771551000000
  }
]
```

### POST `/api/sessions`
Request payload:
- No body

Success response `200`:

```json
{
  "success": true,
  "id": "fdc8ab14-0018-4f8c-8d45-d9f313f09198",
  "message": "New session started"
}
```

### DELETE `/api/sessions/:id`
Request payload:
- Path param: `id`
- No body

Success response `200`:

```json
{
  "success": true,
  "message": "Session deleted"
}
```

### POST `/api/sessions/:id/archive`
Request payload:
- Path param: `id`
- No body

Success response `200`:

```json
{
  "success": true,
  "message": "Session archived"
}
```

### PATCH `/api/sessions/:id/title`
Request payload example:

```json
{
  "title": "Infra diagnostics and webhook checks"
}
```

Success response `200`:

```json
{
  "success": true,
  "message": "Session renamed"
}
```

Validation error `400`:

```json
{
  "error": "Title is required"
}
```

### GET `/api/sessions/:id/messages`
Request payload:
- Path param: `id`
- No body

Success response `200`:

```json
[
  {
    "session_id": "d18e23e6-67db-4ec1-b614-95eeaf399827",
    "created_at": 1771558800010,
    "type": "human",
    "content": "qual a cotacao do bitcoin?"
  },
  {
    "session_id": "d18e23e6-67db-4ec1-b614-95eeaf399827",
    "created_at": 1771558801422,
    "type": "ai",
    "content": "As tarefas foram criadas...",
    "tool_calls": [
      {
        "name": "neo_delegate",
        "args": {
          "task": "Pesquisar cotacao do bitcoin em USD e BRL"
        }
      }
    ],
    "usage_metadata": {
      "input_tokens": 1202,
      "output_tokens": 239,
      "total_tokens": 1441,
      "input_token_details": {
        "cache_read": 0
      }
    }
  },
  {
    "session_id": "sati-evaluation-d18e23e6-67db-4ec1-b614-95eeaf399827",
    "created_at": 1771558801533,
    "type": "tool",
    "content": "[CONTEXT] User tracks BTC frequently",
    "tool_name": "sati_memory",
    "tool_call_id": "sati-eval-01"
  }
]
```

### POST `/api/chat`
Request payload example:

```json
{
  "sessionId": "d18e23e6-67db-4ec1-b614-95eeaf399827",
  "message": "faça um ping em 8.8.8.8"
}
```

Success response `200`:

```json
{
  "response": "Task created: 477fddfc-fab8-49e8-ac00-84b110e7f4ba (apoc)."
}
```

Validation error `400`:

```json
{
  "error": "Invalid input",
  "details": "[...zod details...]"
}
```

## 8.4 Task Endpoints (Protected)

### GET `/api/tasks`
Query params:
- `status`: `pending|running|completed|failed|cancelled`
- `agent`: `apoc|neo|trinit`
- `origin_channel`: `telegram|discord|ui|api|webhook|cli`
- `session_id`: string
- `limit`: number (1..500, default 200)

Request payload:
- No body

Example request:
- `/api/tasks?status=completed&agent=apoc&limit=10`

Success response `200`:

```json
[
  {
    "id": "477fddfc-fab8-49e8-ac00-84b110e7f4ba",
    "agent": "apoc",
    "status": "completed",
    "input": "Ping 8.8.8.8 and report packet stats",
    "context": "User asked from Telegram",
    "output": "Host reachable. 0% loss.",
    "error": null,
    "origin_channel": "telegram",
    "session_id": "d18e23e6-67db-4ec1-b614-95eeaf399827",
    "origin_message_id": "727",
    "origin_user_id": "5852279085",
    "attempt_count": 1,
    "max_attempts": 3,
    "available_at": 1771558600000,
    "created_at": 1771558600000,
    "started_at": 1771558601050,
    "finished_at": 1771558603030,
    "updated_at": 1771558603030,
    "worker_id": "task-worker-b16cb906",
    "notify_status": "sent",
    "notify_attempts": 0,
    "notify_last_error": null,
    "notified_at": 1771558604210
  }
]
```

### GET `/api/tasks/stats`
Request payload:
- No body

Success response `200`:

```json
{
  "pending": 1,
  "running": 0,
  "completed": 25,
  "failed": 2,
  "cancelled": 0,
  "total": 28
}
```

### GET `/api/tasks/:id`
Request payload:
- Path param: `id`
- No body

Success response `200`:
- Same object shape shown in `GET /api/tasks` item.

Not found `404`:

```json
{
  "error": "Task not found"
}
```

### POST `/api/tasks/:id/retry`
Request payload:
- Path param: `id`
- No body

Success response `200`:

```json
{
  "success": true
}
```

Not found `404`:

```json
{
  "error": "Failed task not found for retry"
}
```

## 8.5 Legacy Session Endpoints (Protected)

### POST `/api/session/reset`
Request payload:
- No body

Success response `200`:

```json
{
  "success": true,
  "message": "New session started"
}
```

### POST `/api/session/status`
Request payload:
- No body

Success response `200`:

```json
{
  "id": "d18e23e6-67db-4ec1-b614-95eeaf399827",
  "embedding_status": "none",
  "messageCount": 42
}
```

Not found `404`:

```json
{
  "error": "No session found"
}
```

## 8.6 Runtime Status and Control (Protected)

### GET `/api/status`
Request payload:
- No body

Success response `200`:

```json
{
  "status": "online",
  "uptimeSeconds": 4123.55,
  "pid": 21840,
  "projectVersion": "1.12.0",
  "nodeVersion": "v22.12.0",
  "agentName": "morpheus",
  "llmProvider": "openai",
  "llmModel": "gpt-4o"
}
```

### POST `/api/restart`
Request payload:
- No body

Success response `200`:

```json
{
  "success": true,
  "message": "Restart initiated. Process will shut down and restart shortly."
}
```

## 8.7 Config Endpoints (Protected)

### GET `/api/config`
Request payload:
- No body

Success response `200` (example):

```json
{
  "agent": {
    "name": "morpheus",
    "personality": "helpful_dev"
  },
  "llm": {
    "provider": "openai",
    "model": "gpt-4o",
    "temperature": 0.7,
    "context_window": 100,
    "api_key": "env:OPENAI_API_KEY"
  },
  "sati": {
    "provider": "openai",
    "model": "gpt-4o-mini",
    "temperature": 0.3,
    "memory_limit": 100,
    "enabled_archived_sessions": true
  },
  "neo": {
    "provider": "openai",
    "model": "gpt-4o-mini",
    "temperature": 0.2
  },
  "apoc": {
    "provider": "openai",
    "model": "gpt-4o-mini",
    "temperature": 0.2,
    "working_dir": "E:/morpheus",
    "timeout_ms": 30000
  },
  "channels": {
    "telegram": {
      "enabled": true,
      "token": "env:TELEGRAM_BOT_TOKEN",
      "allowedUsers": [
        "5852279085"
      ]
    },
    "discord": {
      "enabled": false
    }
  },
  "ui": {
    "enabled": true,
    "port": 3333
  },
  "audio": {
    "provider": "google",
    "model": "gemini-2.5-flash-lite",
    "enabled": true,
    "maxDurationSeconds": 300,
    "supportedMimeTypes": [
      "audio/ogg",
      "audio/mp3",
      "audio/mpeg",
      "audio/wav"
    ]
  },
  "logging": {
    "enabled": true,
    "level": "info",
    "retention": "14d"
  },
  "memory": {
    "limit": 100
  },
  "runtime": {
    "async_tasks": {
      "enabled": true
    }
  }
}
```

### POST `/api/config`
Request payload:
- full config object (same shape as GET)

Success response `200`:
- returns saved config object.

Validation error `400`:

```json
{
  "error": "Validation failed",
  "details": [
    {
      "path": [
        "llm",
        "temperature"
      ],
      "message": "Number must be less than or equal to 1"
    }
  ]
}
```

### PUT `/api/config`
Behavior:
- backward compatibility redirect

Response `307`:
- `Location: /api/config`

## 8.8 Agent-specific Config Endpoints (Protected)

### GET `/api/config/sati`
Success response `200` example:

```json
{
  "provider": "openai",
  "model": "gpt-4o-mini",
  "temperature": 0.3,
  "memory_limit": 100,
  "enabled_archived_sessions": true
}
```

### POST `/api/config/sati`
Request payload example:

```json
{
  "provider": "anthropic",
  "model": "claude-3-5-sonnet-20241022",
  "temperature": 0.2,
  "memory_limit": 120,
  "enabled_archived_sessions": true
}
```

Success response `200`:

```json
{
  "success": true
}
```

Validation error `400`:

```json
{
  "error": "Validation failed",
  "details": [
    {
      "path": [
        "sati",
        "provider"
      ],
      "message": "Invalid enum value"
    }
  ]
}
```

### DELETE `/api/config/sati`
Success response `200`:

```json
{
  "success": true
}
```

### GET `/api/config/neo`
Success response `200` example:

```json
{
  "provider": "openai",
  "model": "gpt-4o-mini",
  "temperature": 0.2,
  "context_window": 100,
  "api_key": "env:OPENAI_API_KEY"
}
```

### POST `/api/config/neo`
Request payload example:

```json
{
  "provider": "openrouter",
  "model": "openai/gpt-4o-mini",
  "temperature": 0.2,
  "context_window": 120,
  "base_url": "https://openrouter.ai/api/v1"
}
```

Success response `200`:

```json
{
  "success": true
}
```

### DELETE `/api/config/neo`
Success response `200`:

```json
{
  "success": true
}
```

### GET `/api/config/apoc`
Success response `200` example:

```json
{
  "provider": "openai",
  "model": "gpt-4o-mini",
  "temperature": 0.2,
  "working_dir": "E:/morpheus",
  "timeout_ms": 30000
}
```

### POST `/api/config/apoc`
Request payload example:

```json
{
  "provider": "openai",
  "model": "gpt-4o-mini",
  "temperature": 0.2,
  "working_dir": "E:/morpheus",
  "timeout_ms": 45000
}
```

Success response `200`:

```json
{
  "success": true
}
```

### DELETE `/api/config/apoc`
Success response `200`:

```json
{
  "success": true
}
```

## 8.8b Trinity Agent Config Endpoints (Protected)

### GET `/api/config/trinity`
Success response `200` example:

```json
{
  "provider": "openai",
  "model": "gpt-4o-mini",
  "temperature": 0.2
}
```

### POST `/api/config/trinity`
Request payload example:

```json
{
  "provider": "anthropic",
  "model": "claude-3-5-haiku-20241022",
  "temperature": 0.2
}
```

Success response `200`:

```json
{
  "success": true
}
```

### DELETE `/api/config/trinity`
Success response `200`:

```json
{
  "success": true
}
```

## 8.9 Usage and Pricing Endpoints (Protected)

### GET `/api/stats/usage`
Request payload:
- No body

Success response `200`:

```json
{
  "totalInputTokens": 102442,
  "totalOutputTokens": 18933,
  "totalEstimatedCostUsd": 1.7345
}
```

### GET `/api/stats/usage/grouped`
Success response `200`:

```json
[
  {
    "provider": "openai",
    "model": "gpt-4o",
    "totalInputTokens": 70234,
    "totalOutputTokens": 13002,
    "totalTokens": 83236,
    "messageCount": 220,
    "totalAudioSeconds": 0,
    "estimatedCostUsd": 0.6051
  },
  {
    "provider": "openai",
    "model": "gpt-4o-mini",
    "totalInputTokens": 32208,
    "totalOutputTokens": 5931,
    "totalTokens": 38139,
    "messageCount": 148,
    "totalAudioSeconds": 42.5,
    "estimatedCostUsd": 0.1294
  }
]
```

### GET `/api/model-pricing`
Success response `200`:

```json
[
  {
    "provider": "openai",
    "model": "gpt-4o",
    "input_price_per_1m": 2.5,
    "output_price_per_1m": 10
  }
]
```

### POST `/api/model-pricing`
Request payload example:

```json
{
  "provider": "openai",
  "model": "gpt-4.1",
  "input_price_per_1m": 5,
  "output_price_per_1m": 15
}
```

Success response `200`:

```json
{
  "success": true
}
```

Validation error `400`:

```json
{
  "error": "Invalid payload",
  "details": [
    {
      "code": "too_small",
      "path": [
        "model"
      ],
      "message": "String must contain at least 1 character(s)"
    }
  ]
}
```

### PUT `/api/model-pricing/:provider/:model`
Request payload example:

```json
{
  "input_price_per_1m": 4.5
}
```

Success response `200`:

```json
{
  "success": true
}
```

Not found `404`:

```json
{
  "error": "Pricing entry not found"
}
```

### DELETE `/api/model-pricing/:provider/:model`
Success response `200`:

```json
{
  "success": true
}
```

Not found `404`:

```json
{
  "error": "Pricing entry not found"
}
```

## 8.9b Trinity Database Endpoints (Protected)

### GET `/api/trinity/databases`
Success response `200`:

```json
[
  {
    "id": "a1b2c3d4-1234-5678-abcd-ef0123456789",
    "name": "production-pg",
    "type": "postgres",
    "host": "localhost",
    "port": 5432,
    "database": "myapp",
    "username": "admin",
    "allow_read": true,
    "allow_insert": false,
    "allow_update": false,
    "allow_delete": false,
    "allow_ddl": false,
    "created_at": 1771558600000,
    "updated_at": 1771558600000
  }
]
```

### GET `/api/trinity/databases/:id`
Success response `200`:
- Same object shape as list item.

Not found `404`:

```json
{
  "error": "Database not found"
}
```

### POST `/api/trinity/databases`
Request payload example (PostgreSQL):

```json
{
  "name": "production-pg",
  "type": "postgres",
  "host": "localhost",
  "port": 5432,
  "database": "myapp",
  "username": "admin",
  "password": "secret",
  "allow_read": true,
  "allow_insert": false,
  "allow_update": false,
  "allow_delete": false,
  "allow_ddl": false
}
```

Request payload example (SQLite):

```json
{
  "name": "local-sqlite",
  "type": "sqlite",
  "file_path": "/home/user/data/app.db",
  "allow_read": true
}
```

Success response `201`:

```json
{
  "id": "a1b2c3d4-1234-5678-abcd-ef0123456789",
  "name": "production-pg",
  "type": "postgres"
}
```

### PUT `/api/trinity/databases/:id`
Request payload example (partial update):

```json
{
  "allow_insert": true,
  "allow_update": true
}
```

Success response `200`:

```json
{
  "success": true
}
```

### DELETE `/api/trinity/databases/:id`
Success response `200`:

```json
{
  "success": true
}
```

Not found `404`:

```json
{
  "error": "Database not found"
}
```

### POST `/api/trinity/databases/:id/test`
Tests the database connection.

Success response `200`:

```json
{
  "success": true,
  "message": "Connection successful"
}
```

Failure response `200`:

```json
{
  "success": false,
  "message": "Connection failed: ECONNREFUSED"
}
```

### POST `/api/trinity/databases/:id/refresh-schema`
Re-introspects the database schema and updates the cached schema.

Success response `200`:

```json
{
  "success": true,
  "message": "Schema refreshed"
}
```

## 8.10 Sati Memory Endpoints (Protected)

### GET `/api/sati/memories`
Success response `200`:

```json
[
  {
    "id": "88bc5cd5-57c7-41e0-a4c3-b9b0218078f3",
    "category": "context",
    "importance": "medium",
    "summary": "User often asks about Anthropic news",
    "details": "Persisted from recent conversations",
    "hash": "bb5ad0...",
    "source": "sati-evaluation",
    "created_at": "2026-02-20T01:30:10.000Z",
    "updated_at": "2026-02-20T01:30:10.000Z",
    "last_accessed_at": null,
    "access_count": 0,
    "version": 1,
    "archived": false
  }
]
```

### DELETE `/api/sati/memories/:id`
Success response `200`:

```json
{
  "success": true,
  "message": "Memory archived successfully"
}
```

Not found `404`:

```json
{
  "error": "Memory not found"
}
```

### POST `/api/sati/memories/bulk-delete`
Request payload example:

```json
{
  "ids": [
    "88bc5cd5-57c7-41e0-a4c3-b9b0218078f3",
    "9969aadf-180e-47de-b24b-ef6ab00cf6a5"
  ]
}
```

Success response `200`:

```json
{
  "success": true,
  "message": "2 memories archived successfully",
  "deletedCount": 2
}
```

Validation error `400`:

```json
{
  "error": "Ids array is required and cannot be empty"
}
```

## 8.11 MCP Endpoints (Protected)

### GET `/api/mcp/servers`
Success response `200`:

```json
{
  "servers": [
    {
      "name": "coingecko",
      "enabled": true,
      "config": {
        "transport": "http",
        "url": "https://mcps.example.com/coingecko/mcp",
        "headers": {},
        "args": [],
        "env": {}
      }
    },
    {
      "name": "filesystem",
      "enabled": false,
      "config": {
        "transport": "stdio",
        "command": "npx",
        "args": [
          "-y",
          "@modelcontextprotocol/server-filesystem",
          "E:/morpheus"
        ],
        "env": {}
      }
    }
  ]
}
```

### POST `/api/mcp/servers`
Request payload example:

```json
{
  "name": "coingecko",
  "config": {
    "transport": "http",
    "url": "https://mcps.example.com/coingecko/mcp",
    "headers": {
      "Authorization": "Bearer xxx"
    },
    "args": [],
    "env": {}
  }
}
```

Success response `201`:

```json
{
  "ok": true
}
```

Validation or server error `400|500`:

```json
{
  "error": "Failed to create MCP server.",
  "details": "..."
}
```

### PUT `/api/mcp/servers/:name`
Accepted payload formats:
- Full wrapper with `name` and `config`
- Raw `config` object

Request payload example (raw config):

```json
{
  "transport": "stdio",
  "command": "npx",
  "args": [
    "-y",
    "@modelcontextprotocol/server-filesystem",
    "E:/morpheus"
  ],
  "env": {}
}
```

Success response `200`:

```json
{
  "ok": true
}
```

### DELETE `/api/mcp/servers/:name`
Success response `200`:

```json
{
  "ok": true
}
```

### PATCH `/api/mcp/servers/:name/toggle`
Request payload example:

```json
{
  "enabled": true
}
```

Success response `200`:

```json
{
  "ok": true
}
```

### POST `/api/mcp/reload`
Request payload:
- No body

Success response `200`:

```json
{
  "ok": true,
  "message": "MCP tools reloaded successfully."
}
```

### GET `/api/mcp/status`
Success response `200`:

```json
{
  "servers": [
    {
      "name": "coingecko",
      "ok": true,
      "toolCount": 1
    },
    {
      "name": "filesystem",
      "ok": false,
      "toolCount": 0,
      "error": "Error: connection refused"
    }
  ]
}
```

## 8.12 Logs Endpoints (Protected)

### GET `/api/logs`
Success response `200`:

```json
[
  {
    "name": "morpheus.log",
    "size": 12903,
    "modified": "2026-02-20T15:20:05.443Z"
  },
  {
    "name": "morpheus-2026-02-19.log",
    "size": 25501,
    "modified": "2026-02-19T23:59:59.000Z"
  }
]
```

### GET `/api/logs/:filename?limit=50`
Request payload:
- Path param: `filename`
- Query param: `limit` (optional, default 50)

Success response `200`:

```json
{
  "lines": [
    "[TaskWorker] Task completed: 477fddfc-fab8-49e8-ac00-84b110e7f4ba",
    "[TaskNotifier] Task notifier started."
  ]
}
```

Validation error `400`:

```json
{
  "error": "Invalid filename"
}
```

Not found `404`:

```json
{
  "error": "Log file not found"
}
```

## 8.13 Webhooks Trigger Endpoint (Public)

### POST `/api/webhooks/trigger/:webhook_name`
Auth model:
- public route
- requires header `x-api-key: <webhook_api_key>`

Request payload example:

```json
{
  "event": "deploy_finished",
  "environment": "production",
  "status": "success",
  "sha": "b8a6d4f"
}
```

Success response `202`:

```json
{
  "accepted": true,
  "notification_id": "17ce970d-cde0-4f06-9c9f-5ef92c48aa48"
}
```

Missing key `401`:

```json
{
  "error": "Missing x-api-key header"
}
```

Invalid key/name `401`:

```json
{
  "error": "Invalid webhook name or api key"
}
```

## 8.14 Webhooks Notifications Endpoints (Protected)

### GET `/api/webhooks/notifications`
Query params:
- `webhookId` (optional)
- `unreadOnly=true|false` (optional)

Success response `200`:

```json
[
  {
    "id": "17ce970d-cde0-4f06-9c9f-5ef92c48aa48",
    "webhook_id": "a205cb49-73f4-4217-a97d-58e96d8bf8f1",
    "webhook_name": "deploy-done",
    "status": "completed",
    "payload": "{\"environment\":\"production\",\"status\":\"success\"}",
    "result": "Task completed. Deployment verified.",
    "read": false,
    "created_at": 1771560000000,
    "completed_at": 1771560002211
  }
]
```

### POST `/api/webhooks/notifications/read`
Request payload example:

```json
{
  "ids": [
    "17ce970d-cde0-4f06-9c9f-5ef92c48aa48",
    "3ace5ed3-105d-4f1f-b6ff-b183f9f730f8"
  ]
}
```

Success response `200`:

```json
{
  "success": true
}
```

Validation error `400`:

```json
{
  "error": "Invalid payload",
  "details": [
    {
      "path": [
        "ids"
      ],
      "message": "Array must contain at least 1 element(s)"
    }
  ]
}
```

### GET `/api/webhooks/notifications/unread-count`
Success response `200`:

```json
{
  "count": 3
}
```

## 8.15 Webhooks Management Endpoints (Protected)

### GET `/api/webhooks`
Success response `200`:

```json
[
  {
    "id": "a205cb49-73f4-4217-a97d-58e96d8bf8f1",
    "name": "deploy-done",
    "api_key": "61f2279d-b5c2-4b4f-ac98-b8dbb3cf0d1a",
    "prompt": "Analyze deployment payload and summarize outcome.",
    "enabled": true,
    "notification_channels": [
      "ui",
      "telegram"
    ],
    "created_at": 1771559900000,
    "last_triggered_at": 1771560000000,
    "trigger_count": 4
  }
]
```

### POST `/api/webhooks`
Request payload example:

```json
{
  "name": "deploy-done",
  "prompt": "Analyze deployment payload and summarize outcome.",
  "notification_channels": [
    "ui",
    "telegram"
  ]
}
```

Success response `201`:

```json
{
  "id": "a205cb49-73f4-4217-a97d-58e96d8bf8f1",
  "name": "deploy-done",
  "api_key": "61f2279d-b5c2-4b4f-ac98-b8dbb3cf0d1a",
  "prompt": "Analyze deployment payload and summarize outcome.",
  "enabled": true,
  "notification_channels": [
    "ui",
    "telegram"
  ],
  "created_at": 1771559900000,
  "last_triggered_at": null,
  "trigger_count": 0
}
```

Duplicate name `409`:

```json
{
  "error": "A webhook with name \"deploy-done\" already exists"
}
```

Validation error `400`:

```json
{
  "error": "Invalid payload",
  "details": [
    {
      "path": [
        "name"
      ],
      "message": "Name must be a slug: lowercase letters, numbers, hyphens, underscores only"
    }
  ]
}
```

### GET `/api/webhooks/:id`
Success response `200`:
- Same object shape returned by `POST /api/webhooks`.

Not found `404`:

```json
{
  "error": "Webhook not found"
}
```

### PUT `/api/webhooks/:id`
Request payload example:

```json
{
  "prompt": "Analyze and classify deployment risk level.",
  "enabled": true,
  "notification_channels": [
    "ui"
  ]
}
```

Success response `200`:
- Updated webhook object.

Not found `404`:

```json
{
  "error": "Webhook not found"
}
```

Duplicate name `409`:

```json
{
  "error": "A webhook with that name already exists"
}
```

### DELETE `/api/webhooks/:id`
Success response `200`:

```json
{
  "success": true
}
```

Not found `404`:

```json
{
  "error": "Webhook not found"
}
```

## 8.16 Chronos Scheduler Endpoints (Protected)

### GET `/api/chronos`
Success response `200`:

```json
[
  {
    "id": "882e1452-7c3a-4b1e-9f2d-0123456789ab",
    "prompt": "Check bitcoin price and send summary",
    "schedule_type": "interval",
    "schedule_expression": "every day at 9am",
    "cron_normalized": "0 9 * * *",
    "timezone": "UTC",
    "enabled": true,
    "next_run_at": 1771617600000,
    "last_run_at": 1771531200000,
    "created_at": 1771440000000,
    "updated_at": 1771531200000
  }
]
```

### POST `/api/chronos`
Request payload example:

```json
{
  "prompt": "Check bitcoin price and send summary",
  "schedule_expression": "every day at 9am",
  "timezone": "America/Sao_Paulo"
}
```

Success response `201`:

```json
{
  "id": "882e1452-7c3a-4b1e-9f2d-0123456789ab",
  "prompt": "Check bitcoin price and send summary",
  "schedule_type": "interval",
  "cron_normalized": "0 9 * * *",
  "timezone": "America/Sao_Paulo",
  "enabled": true,
  "next_run_at": 1771617600000
}
```

Validation error `400`:

```json
{
  "error": "Cannot parse schedule expression: \"every 0 minutes\""
}
```

### GET `/api/chronos/:id`
Success response `200`:
- Same object shape as list item, with an additional `recent_executions` array (last 5).

Not found `404`:

```json
{
  "error": "Job not found"
}
```

### PUT `/api/chronos/:id`
Request payload example (partial update):

```json
{
  "prompt": "Check bitcoin and ethereum prices",
  "schedule_expression": "every day at 8am"
}
```

Success response `200`:

```json
{
  "success": true
}
```

### DELETE `/api/chronos/:id`
Success response `200`:

```json
{
  "success": true
}
```

### PATCH `/api/chronos/:id/enable`
Re-enables a disabled job and recomputes `next_run_at` from now.

Success response `200`:

```json
{
  "success": true,
  "next_run_at": 1771617600000
}
```

### PATCH `/api/chronos/:id/disable`
Success response `200`:

```json
{
  "success": true
}
```

### GET `/api/chronos/:id/executions`
Query params:
- `limit` (optional, default 50)

Success response `200`:

```json
[
  {
    "id": "exec-uuid",
    "job_id": "882e1452-7c3a-4b1e-9f2d-0123456789ab",
    "triggered_at": 1771531200000,
    "finished_at": 1771531215000,
    "status": "success",
    "error": null,
    "session_id": "d18e23e6-67db-4ec1-b614-95eeaf399827"
  }
]
```

### POST `/api/chronos/preview`
Preview the next N run timestamps for a given expression.

Request payload example:

```json
{
  "expression": "every weekday at 9am",
  "timezone": "America/Sao_Paulo",
  "count": 5
}
```

Success response `200`:

```json
{
  "timestamps": [
    1771617600000,
    1771704000000,
    1771790400000,
    1771876800000,
    1771963200000
  ],
  "formatted": [
    "2026-02-23T09:00:00-03:00",
    "2026-02-24T09:00:00-03:00",
    "2026-02-25T09:00:00-03:00",
    "2026-02-26T09:00:00-03:00",
    "2026-02-27T09:00:00-03:00"
  ]
}
```

## 8.17 Chronos Config Endpoints (Protected)

### GET `/api/config/chronos`
Success response `200` example:

```json
{
  "check_interval_ms": 60000,
  "default_timezone": "UTC"
}
```

### POST `/api/config/chronos`
Request payload example:

```json
{
  "check_interval_ms": 120000,
  "default_timezone": "America/Sao_Paulo"
}
```

Success response `200`:

```json
{
  "success": true
}
```

### DELETE `/api/config/chronos`
Resets Chronos config to defaults.

Success response `200`:

```json
{
  "success": true
}
```

## 9. Operational Notes

### 9.1 Async Toggle
Set `runtime.async_tasks.enabled: false` to disable worker/notifier execution loop.

### 9.2 Task Acknowledgement vs Result
Oracle acknowledgement confirms queue insertion only.
Final execution output is delivered by notifier flow when task completes/fails.

### 9.3 Language Handling
Neo and Apoc are instructed to respond in the language requested by the user or dominant task/context language.

## 10. Development and Testing

```bash
npm install
npm run build
npm run dev:cli
npm run dev:ui
npm test
```

## 11. Related Documents
- `README.md`
- `ARCHITECTURE.md`
- `PRODUCT.md`
