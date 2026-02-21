<div align="center">
  <img src="./assets/logo.png" alt="Morpheus Logo" width="220" />
</div>

# Morpheus

Morpheus is a local-first AI operator for developers.
It runs as a daemon and orchestrates LLMs, MCP tools, DevKit tools, memory, and channels (Web UI, Telegram, API, webhooks).

## Why Morpheus
- Local-first persistence (sessions, messages, usage, tasks).
- Multi-agent architecture (Oracle, Neo, Apoc, Sati).
- Async task execution with queue + worker + notifier.
- Rich operational visibility in UI (chat traces, tasks, usage, logs).

## Multi-Agent Roles
- `Oracle`: orchestration and routing. Decides direct answer vs async delegation.
- `Neo`: MCP and internal operational tools (config, diagnostics, analytics).
- `Apoc`: DevTools/browser execution (filesystem, shell, git, network, packages, processes, system, browser automation).
- `Sati`: long-term memory retrieval/evaluation.
- `Trinity`: database specialist. Executes queries, introspects schemas, and manages registered databases (PostgreSQL, MySQL, SQLite, MongoDB).

## Installation

```bash
npm install -g morpheus-cli
```

## Quick Start

### 1. Initialize

```bash
morpheus init
```

Creates:
- `~/.morpheus/zaion.yaml`
- `~/.morpheus/mcps.json`
- local memory/log folders

### 2. Start

```bash
morpheus start
```

Useful flags:

```bash
morpheus start -y            # auto-restart if another instance is running
morpheus start --no-ui       # disable web UI
morpheus start --port 3333   # override UI port
```

### 3. Control Commands

```bash
morpheus status
morpheus stop
morpheus restart
morpheus doctor
morpheus session new
morpheus session status
```

## Async Task Execution

Morpheus uses asynchronous delegation by default:

1. Oracle receives user request.
2. If execution is needed, Oracle calls `neo_delegate`, `apoc_delegate`, or `trinity_delegate`.
3. Delegate tool creates a row in `tasks` table with origin metadata (`channel`, `session`, `message`, `user`).
4. Oracle immediately acknowledges task creation.
5. `TaskWorker` executes pending tasks (routes `trinit` tasks to Trinity agent).
6. `TaskNotifier` sends completion/failure through `TaskDispatcher`.

Important behavior:
- Oracle stays responsive while tasks run.
- Delegations must be atomic (single objective per task).
- Duplicate/fabricated task acknowledgements are blocked by validation against DB.
- Status follow-ups are handled by Oracle through `task_query` (no delegation required).

## Telegram Experience

Telegram responses use rich HTML formatting conversion with:
- bold/italic/list rendering from markdown-like text
- inline code and fenced code blocks
- auto-wrapped UUIDs in `<code>` for easier copy

Task results are delivered proactively with metadata (task id, agent, status) and output/error body.

## Web UI

The dashboard includes:
- Chat with session management
- Tasks page (stats, filters, details, retry)
- Agent settings (Oracle/Sati/Neo/Apoc/Trinity)
- MCP manager (add/edit/delete/toggle/reload)
- Sati memories (search, bulk delete)
- Usage stats and model pricing
- Trinity databases (register/test/refresh schema)
- Webhooks and notification inbox
- Logs viewer

Chat-specific rendering:
- AI messages rendered as markdown
- Tool payloads shown in collapsible blocks
- SATI-related tool content grouped under `SATI Memory`
- per-message token badge (`input/output`)

## Configuration (`~/.morpheus/zaion.yaml`)

```yaml
agent:
  name: morpheus
  personality: helpful_dev

llm: # Oracle
  provider: openai
  model: gpt-4o
  temperature: 0.7
  context_window: 100
  api_key: env:OPENAI_API_KEY

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
  context_window: 100

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

runtime:
  async_tasks:
    enabled: true

channels:
  telegram:
    enabled: false
    token: env:TELEGRAM_BOT_TOKEN
    allowedUsers: ["123456789"]
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

## Environment Variables

Provider-specific keys:
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GOOGLE_API_KEY`
- `OPENROUTER_API_KEY`
- `TELEGRAM_BOT_TOKEN`
- `THE_ARCHITECT_PASS`

Security:
- `MORPHEUS_SECRET` — AES-256-GCM key for encrypting Trinity database passwords (required when using Trinity)

Generic Morpheus overrides (selected):

| Variable | Target |
|---|---|
| `MORPHEUS_AGENT_NAME` | `agent.name` |
| `MORPHEUS_AGENT_PERSONALITY` | `agent.personality` |
| `MORPHEUS_LLM_PROVIDER` | `llm.provider` |
| `MORPHEUS_LLM_MODEL` | `llm.model` |
| `MORPHEUS_LLM_TEMPERATURE` | `llm.temperature` |
| `MORPHEUS_LLM_MAX_TOKENS` | `llm.max_tokens` |
| `MORPHEUS_LLM_CONTEXT_WINDOW` | `llm.context_window` |
| `MORPHEUS_LLM_API_KEY` | `llm.api_key` |
| `MORPHEUS_SATI_PROVIDER` | `sati.provider` |
| `MORPHEUS_SATI_MODEL` | `sati.model` |
| `MORPHEUS_SATI_TEMPERATURE` | `sati.temperature` |
| `MORPHEUS_SATI_MAX_TOKENS` | `sati.max_tokens` |
| `MORPHEUS_SATI_CONTEXT_WINDOW` | `sati.context_window` |
| `MORPHEUS_SATI_API_KEY` | `sati.api_key` |
| `MORPHEUS_SATI_MEMORY_LIMIT` | `sati.memory_limit` |
| `MORPHEUS_SATI_ENABLED_ARCHIVED_SESSIONS` | `sati.enabled_archived_sessions` |
| `MORPHEUS_NEO_PROVIDER` | `neo.provider` |
| `MORPHEUS_NEO_MODEL` | `neo.model` |
| `MORPHEUS_NEO_TEMPERATURE` | `neo.temperature` |
| `MORPHEUS_NEO_MAX_TOKENS` | `neo.max_tokens` |
| `MORPHEUS_NEO_CONTEXT_WINDOW` | `neo.context_window` |
| `MORPHEUS_NEO_API_KEY` | `neo.api_key` |
| `MORPHEUS_NEO_BASE_URL` | `neo.base_url` |
| `MORPHEUS_APOC_PROVIDER` | `apoc.provider` |
| `MORPHEUS_APOC_MODEL` | `apoc.model` |
| `MORPHEUS_APOC_TEMPERATURE` | `apoc.temperature` |
| `MORPHEUS_APOC_MAX_TOKENS` | `apoc.max_tokens` |
| `MORPHEUS_APOC_CONTEXT_WINDOW` | `apoc.context_window` |
| `MORPHEUS_APOC_API_KEY` | `apoc.api_key` |
| `MORPHEUS_APOC_WORKING_DIR` | `apoc.working_dir` |
| `MORPHEUS_APOC_TIMEOUT_MS` | `apoc.timeout_ms` |
| `MORPHEUS_TRINITY_PROVIDER` | `trinity.provider` |
| `MORPHEUS_TRINITY_MODEL` | `trinity.model` |
| `MORPHEUS_TRINITY_TEMPERATURE` | `trinity.temperature` |
| `MORPHEUS_TRINITY_API_KEY` | `trinity.api_key` |
| `MORPHEUS_AUDIO_PROVIDER` | `audio.provider` |
| `MORPHEUS_AUDIO_MODEL` | `audio.model` |
| `MORPHEUS_AUDIO_ENABLED` | `audio.enabled` |
| `MORPHEUS_AUDIO_API_KEY` | `audio.apiKey` |
| `MORPHEUS_AUDIO_MAX_DURATION` | `audio.maxDurationSeconds` |
| `MORPHEUS_TELEGRAM_ENABLED` | `channels.telegram.enabled` |
| `MORPHEUS_TELEGRAM_TOKEN` | `channels.telegram.token` |
| `MORPHEUS_TELEGRAM_ALLOWED_USERS` | `channels.telegram.allowedUsers` |
| `MORPHEUS_UI_ENABLED` | `ui.enabled` |
| `MORPHEUS_UI_PORT` | `ui.port` |
| `MORPHEUS_LOGGING_ENABLED` | `logging.enabled` |
| `MORPHEUS_LOGGING_LEVEL` | `logging.level` |
| `MORPHEUS_LOGGING_RETENTION` | `logging.retention` |

Precedence order:
1. Provider-specific environment variable
2. Generic `MORPHEUS_*` variable
3. `zaion.yaml`
4. Defaults

## MCP Configuration

Configure MCP servers in `~/.morpheus/mcps.json`.

```json
{
  "coingecko": {
    "transport": "http",
    "url": "https://mcps.example.com/coingecko/mcp"
  },
  "filesystem": {
    "transport": "stdio",
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "./"]
  }
}
```

## API Highlights

Public endpoints:
- `GET /health`
- `GET /api/health`
- `POST /api/webhooks/trigger/:webhook_name` (auth via `x-api-key`)

Authenticated endpoints (`x-architect-pass`):
- Sessions: `/api/sessions*`
- Chat: `POST /api/chat`
- Tasks: `GET /api/tasks`, `GET /api/tasks/stats`, `GET /api/tasks/:id`, `POST /api/tasks/:id/retry`
- Config: `/api/config`, `/api/config/sati`, `/api/config/neo`, `/api/config/apoc`, `/api/config/trinity`
- MCP: `/api/mcp/*` (servers CRUD + reload + status)
- Sati memories: `/api/sati/memories*`
- Trinity databases: `GET/POST/PUT/DELETE /api/trinity/databases`, `POST /api/trinity/databases/:id/test`, `POST /api/trinity/databases/:id/refresh-schema`
- Usage/model pricing/logs/restart
- Webhook management and webhook notifications

## API Payload/Response Examples

Auth header for protected endpoints:

```http
x-architect-pass: <THE_ARCHITECT_PASS>
```

Example `POST /api/chat` payload:

```json
{
  "sessionId": "d18e23e6-67db-4ec1-b614-95eeaf399827",
  "message": "faça um ping em 8.8.8.8"
}
```

Example `POST /api/chat` response:

```json
{
  "response": "Task created: 477fddfc-fab8-49e8-ac00-84b110e7f4ba (apoc)."
}
```

Example `GET /api/tasks/:id` response:

```json
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
```

Example webhook trigger payload (`POST /api/webhooks/trigger/:webhook_name`):

```json
{
  "event": "deploy_finished",
  "environment": "production",
  "status": "success",
  "sha": "b8a6d4f"
}
```

Example webhook trigger response:

```json
{
  "accepted": true,
  "notification_id": "17ce970d-cde0-4f06-9c9f-5ef92c48aa48"
}
```

Complete payload and response examples for **all** endpoints are in `DOCUMENTATION.md` (Section `8. API Reference (Complete Payloads and Response Examples)`).

## Development

```bash
npm install
npm run build
npm run dev:cli
npm run dev:ui
npm test
```

## Project Structure

```text
src/
  channels/    # Telegram adapter
  cli/         # start/stop/restart/status/doctor
  config/      # config loading, precedence, schemas
  devkit/      # Apoc tool factories
  http/        # API, auth, webhooks, server
  runtime/
    apoc.ts
    neo.ts
    oracle.ts
    trinity.ts
    trinity-connector.ts  # PostgreSQL/MySQL/SQLite/MongoDB drivers
    trinity-crypto.ts     # AES-256-GCM encryption for DB passwords
    memory/
    tasks/
    tools/
    webhooks/
  ui/          # React dashboard
```

## Related Docs
- `ARCHITECTURE.md`
- `PRODUCT.md`
- `DOCUMENTATION.md`

## License
MIT
