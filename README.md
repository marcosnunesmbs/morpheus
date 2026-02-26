<div align="center">
  <img src="./assets/logo.png" alt="Morpheus Logo" width="220" />
</div>

# Morpheus

Morpheus is a local-first AI operator for developers.
It runs as a daemon and orchestrates LLMs, MCP tools, DevKit tools, memory, and channels (Web UI, Telegram, Discord, API, webhooks).

## Why Morpheus
- Local-first persistence (sessions, messages, usage, tasks).
- Multi-agent architecture (Oracle, Neo, Apoc, Sati, Trinity).
- Async task execution with queue + worker + notifier.
- Chronos temporal scheduler for recurring and one-time Oracle executions.
- Multi-channel output via ChannelRegistry (Telegram, Discord) with per-job routing.
- Rich operational visibility in UI (chat traces, tasks, usage, logs).

## Multi-Agent Roles
- `Oracle`: orchestration and routing. Decides direct answer vs async delegation.
- `Neo`: MCP and internal operational tools (config, diagnostics, analytics).
- `Apoc`: DevTools/browser execution (filesystem, shell, git, network, packages, processes, system, browser automation).
- `Sati`: long-term memory retrieval/evaluation.
- `Trinity`: database specialist. Executes queries, introspects schemas, and manages registered databases (PostgreSQL, MySQL, SQLite, MongoDB).
- `Chronos`: temporal scheduler. Runs Oracle prompts on a recurring or one-time schedule.
- `Keymaker`: skill executor. Runs user-defined skills with full tool access (DevKit + MCP + internal tools).

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

## Docker

### Docker Compose (recommended)

**1. Create an `env.docker` file** (referenced by `docker-compose.yml`):

```bash
cp .env.example env.docker   # or create manually
```

Minimal `env.docker`:

```env
OPENAI_API_KEY=sk-...
THE_ARCHITECT_PASS=changeme
MORPHEUS_SECRET=<generate-a-random-secret>
```

> **Tip:** Generate a secure `MORPHEUS_SECRET` with: `openssl rand -base64 32` or `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`

**2. Run:**

```bash
docker compose up -d
```

The dashboard will be available at `http://localhost:3333`.

**Useful commands:**

```bash
docker compose logs -f          # follow logs
docker compose restart morpheus # restart the agent
docker compose down             # stop
docker compose down -v          # stop and remove persistent data
```

**Data persistence:** configuration and databases are stored in the `morpheus_data` Docker volume (`/root/.morpheus` inside the container). They survive container restarts and rebuilds.

**Override variables** at runtime via the `environment` block in `docker-compose.yml` or directly in `env.docker`. All `MORPHEUS_*` env vars work the same as in a native install. See the [Environment Variables](#environment-variables) section for the full list.

### Docker (standalone)

**Build:**

```bash
docker build -t morpheus .
```

**Run:**

```bash
docker run -d \
  --name morpheus-agent \
  -p 3333:3333 \
  -e OPENAI_API_KEY=sk-... \
  -e THE_ARCHITECT_PASS=changeme \
  -e MORPHEUS_SECRET=<generate-a-random-secret> \
  -v morpheus_data:/root/.morpheus \
  morpheus
```

**With Telegram:**

```bash
docker run -d \
  --name morpheus-agent \
  -p 3333:3333 \
  -e OPENAI_API_KEY=sk-... \
  -e THE_ARCHITECT_PASS=changeme \
  -e MORPHEUS_SECRET=<generate-a-random-secret> \
  -e MORPHEUS_TELEGRAM_ENABLED=true \
  -e MORPHEUS_TELEGRAM_TOKEN=<bot-token> \
  -e MORPHEUS_TELEGRAM_ALLOWED_USERS=123456789 \
  -v morpheus_data:/root/.morpheus \
  morpheus
```

**With Discord:**

```bash
docker run -d \
  --name morpheus-agent \
  -p 3333:3333 \
  -e OPENAI_API_KEY=sk-... \
  -e THE_ARCHITECT_PASS=changeme \
  -e MORPHEUS_SECRET=<generate-a-random-secret> \
  -e MORPHEUS_DISCORD_ENABLED=true \
  -e MORPHEUS_DISCORD_TOKEN=<bot-token> \
  -e MORPHEUS_DISCORD_ALLOWED_USERS=987654321 \
  -v morpheus_data:/root/.morpheus \
  morpheus
```

**Health check:** the container exposes `GET /health` and Docker will probe it every 30s (60s start period, 3 retries before marking unhealthy).

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

## Chronos — Temporal Scheduler

Chronos lets you schedule any Oracle prompt to run at a fixed time or on a recurring schedule.

**Schedule types:**
- `once` — run once at a specific time: `"in 30 minutes"`, `"tomorrow at 9am"`, `"2026-03-01T09:00:00"`
- `interval` — recurring natural language: `"every day at 9am"`, `"every weekday"`, `"every monday and friday at 8am"`, `"every 30 minutes"`
- `cron` — raw 5-field cron: `"0 9 * * 1-5"`

**Execution model:**
- Jobs run inside the currently active Oracle session — no isolated sessions are created per job.
- Chronos injects context as an AI message before invoking `oracle.chat()`, keeping conversation history clean.
- Each job has a `notify_channels` field: empty = broadcast to all active channels, `["telegram"]` = Telegram only, `["discord"]` = Discord only.
- When creating jobs via Oracle chat, the channel is auto-detected from the conversation origin. You can override it explicitly: *"lembre no Discord"*, *"em todos os canais"*.

**Oracle tools:** `chronos_schedule`, `chronos_list`, `chronos_cancel`, `chronos_preview`

**Telegram commands:**
- `/chronos <prompt> @ <schedule>` — create a job
- `/chronos_list` — list all jobs (🟢 active / 🔴 disabled)
- `/chronos_view <id>` — view job details and last 5 executions
- `/chronos_enable <id>` / `/chronos_disable <id>` / `/chronos_delete <id>`

**Discord slash commands:**
- `/chronos prompt: time:` — create a job (prompt and time as separate fields)
- `/chronos_list` — list all jobs
- `/chronos_view id:` / `/chronos_disable id:` / `/chronos_enable id:` / `/chronos_delete id:`

**API endpoints (protected):**
- `GET/POST /api/chronos` — list / create jobs
- `GET/PUT/DELETE /api/chronos/:id` — read / update / delete
- `PATCH /api/chronos/:id/enable` / `.../disable`
- `GET /api/chronos/:id/executions`
- `POST /api/chronos/preview` — preview next N run timestamps
- `GET/POST/DELETE /api/config/chronos`

## Telegram Experience

Telegram responses use rich HTML formatting conversion with:
- bold/italic/list rendering from markdown-like text
- inline code and fenced code blocks
- auto-wrapped UUIDs in `<code>` for easier copy

Task results are delivered proactively with metadata (task id, agent, status) and output/error body.

**Voice messages:** Telegram voice messages are automatically transcribed (Gemini / Whisper / OpenRouter) and processed as text through the Oracle.

## Discord Experience

Discord bot responds to **DMs only** from authorized user IDs (`allowedUsers`).

**Slash commands** (registered automatically on startup):

| Command | Description |
|---|---|
| `/help` | Show available commands |
| `/status` | Check Morpheus status |
| `/stats` | Token usage statistics |
| `/newsession` | Start a new session |
| `/mcps` | List MCP servers with tool counts |
| `/mcpreload` | Reload MCP connections and tools |
| `/mcp_enable name:` | Enable an MCP server |
| `/mcp_disable name:` | Disable an MCP server |
| `/chronos prompt: time:` | Schedule a job |
| `/chronos_list` | List all scheduled jobs |
| `/chronos_view id:` | View job + executions |
| `/chronos_disable id:` | Disable a job |
| `/chronos_enable id:` | Enable a job |
| `/chronos_delete id:` | Delete a job |

**Voice messages:** Discord voice messages and audio file attachments are transcribed and processed identically to Telegram.

**Setup:**
1. Create an application at [discord.com/developers](https://discord.com/developers/applications).
2. Under **Bot**, enable **Message Content Intent** (Privileged Gateway Intents).
3. Copy the Bot Token and add it to Settings → Channels → Discord.
4. Add your Discord user ID to **Allowed Users**.
5. Invite the bot to a server via OAuth2 URL Generator (`bot` scope). The bot must share a server with you for DMs to work.

## Channel Routing

Morpheus uses a central `ChannelRegistry` so every adapter (Telegram, Discord) registers itself at startup. Task notifications and Chronos job results are routed through the registry:

- `notify_channels: []` → broadcast to all active channels
- `notify_channels: ["telegram"]` → Telegram only
- `notify_channels: ["discord"]` → Discord only
- `origin_channel: 'chronos'` (on tasks) → broadcast

Adding a new channel requires only implementing `IChannelAdapter` (`channel`, `sendMessage`, `sendMessageToUser`, `disconnect`) and calling `ChannelRegistry.register()` in `start.ts`.

## Web UI

The dashboard includes:
- Chat with session management
- Tasks page (stats, filters, details, retry)
- Agent settings (Oracle/Sati/Neo/Apoc/Trinity)
- MCP manager (add/edit/delete/toggle/reload)
- Sati memories (search, bulk delete)
- Usage stats and model pricing
- Trinity databases (register/test/refresh schema)
- Chronos scheduler (create/edit/delete jobs, execution history)
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
  personality: analytical_engineer

apoc:
  provider: openai
  model: gpt-4o-mini
  temperature: 0.2
  working_dir: /home/user/projects
  timeout_ms: 30000
  personality: pragmatic_dev

trinity:
  provider: openai
  model: gpt-4o-mini
  temperature: 0.2
  personality: data_specialist

chronos:
  check_interval_ms: 60000   # polling interval in ms (minimum 60000)
  default_timezone: UTC      # IANA timezone used when none is specified

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
    token: env:DISCORD_BOT_TOKEN
    allowedUsers: ["987654321"]

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
- `DISCORD_BOT_TOKEN`
- `THE_ARCHITECT_PASS`

Security:
- `MORPHEUS_SECRET` — AES-256-GCM encryption key for Trinity database passwords and agent API keys. When set, all API keys saved via UI or config file are automatically encrypted at rest.

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
| `MORPHEUS_NEO_PERSONALITY` | `neo.personality` |
| `MORPHEUS_APOC_PROVIDER` | `apoc.provider` |
| `MORPHEUS_APOC_MODEL` | `apoc.model` |
| `MORPHEUS_APOC_TEMPERATURE` | `apoc.temperature` |
| `MORPHEUS_APOC_MAX_TOKENS` | `apoc.max_tokens` |
| `MORPHEUS_APOC_CONTEXT_WINDOW` | `apoc.context_window` |
| `MORPHEUS_APOC_API_KEY` | `apoc.api_key` |
| `MORPHEUS_APOC_WORKING_DIR` | `apoc.working_dir` |
| `MORPHEUS_APOC_TIMEOUT_MS` | `apoc.timeout_ms` |
| `MORPHEUS_APOC_PERSONALITY` | `apoc.personality` |
| `MORPHEUS_TRINITY_PROVIDER` | `trinity.provider` |
| `MORPHEUS_TRINITY_MODEL` | `trinity.model` |
| `MORPHEUS_TRINITY_TEMPERATURE` | `trinity.temperature` |
| `MORPHEUS_TRINITY_API_KEY` | `trinity.api_key` |
| `MORPHEUS_TRINITY_PERSONALITY` | `trinity.personality` |
| `MORPHEUS_AUDIO_PROVIDER` | `audio.provider` |
| `MORPHEUS_AUDIO_MODEL` | `audio.model` |
| `MORPHEUS_AUDIO_ENABLED` | `audio.enabled` |
| `MORPHEUS_AUDIO_API_KEY` | `audio.apiKey` |
| `MORPHEUS_AUDIO_MAX_DURATION` | `audio.maxDurationSeconds` |
| `MORPHEUS_TELEGRAM_ENABLED` | `channels.telegram.enabled` |
| `MORPHEUS_TELEGRAM_TOKEN` | `channels.telegram.token` |
| `MORPHEUS_TELEGRAM_ALLOWED_USERS` | `channels.telegram.allowedUsers` |
| `MORPHEUS_DISCORD_ENABLED` | `channels.discord.enabled` |
| `MORPHEUS_DISCORD_TOKEN` | `channels.discord.token` |
| `MORPHEUS_DISCORD_ALLOWED_USERS` | `channels.discord.allowedUsers` |
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

## Skills

Skills are user-defined capabilities that extend Morpheus. Each skill is a folder in `~/.morpheus/skills/` containing a single `SKILL.md` file with YAML frontmatter for metadata.

### Execution Modes

Skills support two execution modes:

- **`sync`** (default) - Executes immediately via `skill_execute`, returns result inline
- **`async`** - Runs as background task via `skill_delegate`, notifies when complete

### Creating a Skill

```bash
mkdir -p ~/.morpheus/skills/my-skill
```

**SKILL.md:**
```markdown
---
name: my-skill
description: Brief description of what this skill does
version: 1.0.0
author: your-name
enabled: true
execution_mode: sync
tags:
  - automation
  - example
examples:
  - "Example prompt that triggers this skill"
---

# My Skill

You are an expert at [domain]. Follow these instructions...

## Your Task
[Instructions for Keymaker to execute]
```

### Async Skill Example

For long-running tasks like deployments or builds:

```markdown
---
name: deploy-staging
description: Deploy application to staging environment
execution_mode: async
tags:
  - deployment
  - devops
---

# Deploy to Staging

Execute a full deployment to the staging environment...
```

### Using Skills

Once a skill is loaded, Oracle will automatically suggest delegating matching tasks to Keymaker:

**Sync Skills (immediate result):**
```
User: "Review the code in src/auth.ts"
Oracle: [executes code-reviewer skill via skill_execute]
Keymaker: [returns detailed review immediately]
```

**Async Skills (background task):**
```
User: "Deploy to staging"
Oracle: [delegates via skill_delegate, task queued]
Morpheus: [notifies via Telegram/Discord when complete]
```

### Managing Skills

**CLI Commands:**
```bash
# View loaded skills
morpheus skills

# Reload skills from disk
morpheus skills --reload
```

**API Endpoints:**
```
GET    /api/skills           - List all skills
GET    /api/skills/:name     - Get skill details
POST   /api/skills/reload    - Reload from filesystem
POST   /api/skills/:name/enable   - Enable skill
POST   /api/skills/:name/disable  - Disable skill
```

**Telegram/Discord Commands:**
```
/skills              - List skills
/skill_reload        - Reload skills
/skill_enable <name> - Enable a skill
/skill_disable <name> - Disable a skill
```

### Sample Skills

Example skills are available in `examples/skills/`:
- `code-reviewer` - Reviews code for issues and best practices (sync)
- `git-helper` - Assists with Git operations (sync)
- `deploy-staging` - Deploy to staging environment (async)

Copy them to your skills directory:
```bash
cp -r examples/skills/* ~/.morpheus/skills/
```

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
- Config: `/api/config`, `/api/config/sati`, `/api/config/neo`, `/api/config/apoc`, `/api/config/trinity`, `/api/config/chronos`
- MCP: `/api/mcp/*` (servers CRUD + reload + status)
- Sati memories: `/api/sati/memories*`
- Trinity databases: `GET/POST/PUT/DELETE /api/trinity/databases`, `POST /api/trinity/databases/:id/test`, `POST /api/trinity/databases/:id/refresh-schema`
- Chronos: `GET/POST /api/chronos`, `GET/PUT/DELETE /api/chronos/:id`, `PATCH /api/chronos/:id/enable`, `PATCH /api/chronos/:id/disable`, `GET /api/chronos/:id/executions`, `POST /api/chronos/preview`
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
  channels/
    telegram.ts          # Telegram adapter (commands, voice, inline buttons)
    discord.ts           # Discord adapter (slash commands, voice, DM-only)
    registry.ts          # ChannelRegistry — central adapter router
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
    chronos/
      worker.ts           # polling timer and job execution
      repository.ts       # SQLite-backed job and execution store
      parser.ts           # natural-language schedule parser
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
