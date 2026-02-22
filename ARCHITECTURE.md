# Morpheus Architecture Reference

## 1. System Overview
Morpheus is a local-first AI operator running as a long-lived daemon. It orchestrates:
- LLM inference
- asynchronous task execution
- persistent memory and token accounting
- multi-channel delivery (UI, Telegram, webhooks)

The runtime is a modular monolith built on Node.js + TypeScript, with SQLite as the source of truth for sessions, messages, usage, and tasks.

## 2. Core Architecture

### 2.1 Runtime Core (`src/runtime`)
- `oracle.ts`: orchestration brain. Routes requests, decides whether to answer directly or enqueue delegated work.
- `neo.ts`: execution subagent for MCP + Morpheus internal tools (config, diagnostics, analytics).
- `apoc.ts`: execution subagent for DevKit operations (filesystem, shell, git, network, processes, packages, system).
- `memory/sati/*`: long-term memory pipeline (retrieval + post-response memory evaluation).
- `tasks/*`: async task queue repository, worker, notifier, dispatcher, and request context.
- `chronos/*`: temporal scheduler — job store, polling worker, natural-language schedule parser.

### 2.2 Interfaces
- `src/channels/telegram.ts`: Telegram adapter (commands, chat, voice transcription, proactive task notifications).
- `src/http/*`: Express API + UI hosting + webhooks.
- `src/ui/*`: React dashboard for chat, tasks, settings, logs, stats, MCP, webhooks.

### 2.3 Infrastructure
- `src/config/*`: zod-validated config + env precedence.
- `src/cli/commands/*`: lifecycle control (`start`, `stop`, `restart`, `status`, `doctor`).

## 3. Multi-Agent Model

| Agent | Responsibility | Tool Scope |
|---|---|---|
| Oracle | Conversation orchestrator and router | `task_query`, `neo_delegate`, `apoc_delegate`, `trinity_delegate` |
| Neo | Analytical/operational execution | Runtime MCP tools + config/diagnostic/analytics tools |
| Apoc | DevTools and browser execution | DevKit toolchain |
| Trinity | Database specialist | PostgreSQL/MySQL/SQLite/MongoDB query execution + schema introspection |
| Sati | Long-term memory evaluator | No execution tools (memory-focused reasoning) |

Key design choice: Oracle no longer carries MCP tool load directly. It delegates execution asynchronously and stays responsive.

## 4. Async Task Orchestration

### 4.1 Delegation Lifecycle
1. User request arrives at Oracle.
2. Oracle decides:
   - direct response (conversation only), or
   - delegated execution via `neo_delegate` / `apoc_delegate`.
3. Delegate tool writes a task into `tasks` table (`status = pending`) with full origin context:
   - `origin_channel`
   - `session_id`
   - `origin_message_id`
   - `origin_user_id`
   - `agent` column: `neo`, `apoc`, or `trinit` (Trinity tasks are stored as `trinit`)
4. Oracle returns an acknowledgement (no execution output) and remains available.
5. `TaskWorker` claims pending tasks and executes subagent work.
6. Worker marks task `completed` or `failed`.
7. `TaskNotifier` picks finished tasks awaiting notification.
8. `TaskDispatcher` delivers result:
   - Telegram proactive message for telegram-origin tasks
   - webhook notification update for webhook-origin tasks

### 4.2 Queue and Reliability
Implemented in `src/runtime/tasks/repository.ts`:
- durable fields: `available_at`, `attempt_count`, `max_attempts`, `worker_id`
- notification lifecycle: `notify_status`, `notify_attempts`, `notify_last_error`, `notified_at`
- retry/backoff for execution failures
- stale-running and stale-notification recovery

### 4.3 Delegation Guards
- Atomic-only delegation: composite multi-action task payloads are rejected.
- Per-turn delegation cap via `TaskRequestContext`.
- Duplicate delegation deduplication in the same request context.
- Oracle validates task IDs against DB before acknowledging creation.
- Synthetic/fabricated "task created" responses are blocked if no valid task exists.

## 5. Session, Memory, and Usage Persistence

### 5.1 Short-Term Memory (`short-memory.db`)
`SQLiteChatMessageHistory` stores message rows with:
- `session_id`, `type`, `content`, `created_at`
- token columns: `input_tokens`, `output_tokens`, `total_tokens`, `cache_read_tokens`
- model provenance: `provider`, `model`
- `audio_duration_seconds` when applicable

### 5.2 Long-Term Memory (`sati-memory.db`)
Sati retrieval enriches Oracle context before execution. Sati post-processing extracts durable memory facts after non-delegation turns.

### 5.3 Token Accounting
- Oracle persists both direct answers and delegation acknowledgements.
- Neo and Apoc persist their final task outputs as AI messages under the task session.
- UI can render per-message token badges from stored usage metadata.

## 6. HTTP/API and UI

### 6.1 API Surface
Main API router (`src/http/api.ts`) provides:
- sessions and chat
- tasks listing/stats/detail/retry
- config management (`/config`, `/config/sati`, `/config/neo`, `/config/apoc`, `/config/trinity`, `/config/chronos`)
- usage statistics and model pricing
- MCP management and reload (`/mcp/servers`, `/mcp/reload`, `/mcp/status`)
- Trinity database registry (`/trinity/databases` CRUD + test + refresh-schema)
- Chronos scheduler (`/chronos` CRUD + enable/disable + executions + preview)
- logs

Webhooks router (`src/http/webhooks-router.ts`) provides:
- public trigger endpoint by webhook key
- authenticated webhook CRUD + notifications

### 6.2 UI Capabilities
- Tasks page with live queue visibility, filters, status cards, and retry action.
- Chat page with:
  - tool-call message visibility
  - SATI messages grouped as collapsible `SATI Memory`
  - markdown rendering for AI responses
  - per-message token badges (input/output)
- Agents settings with dedicated Oracle/Sati/Neo/Apoc/Trinity tabs.
- Trinity Databases page: register databases, test connections, refresh schema, set per-permission flags (read/insert/update/delete/ddl).
- MCP Manager: CRUD, enable/disable toggle, live probe status, hot reload.
- Chronos page: create/edit/delete scheduled jobs, enable/disable toggle, execution history per job.
- Logs viewer: browse log files, auto-scroll to latest entries, timestamps hidden on mobile.

## 7. Telegram Delivery Model

Telegram adapter uses rich HTML formatting conversion for dynamic responses:
- markdown-like bold/italic/lists/code support
- code blocks and inline code preservation
- UUID auto-wrapping in `<code>` for easier copy

Task completion notifications are proactive and include task metadata (id, agent, status) plus output/error body.

## 8. Trinity — Database Subsystem

### 8.1 Components
- `src/runtime/trinity.ts`: Trinity subagent (ReactAgent). Executes SQL/NoSQL queries and introspects schemas.
- `src/runtime/memory/trinity-db.ts`: `DatabaseRegistry` — CRUD for registered databases, backed by `trinity.db` (SQLite).
- `src/runtime/trinity-connector.ts`: driver adapters for PostgreSQL (`pg`), MySQL (`mysql2`), SQLite (`better-sqlite3`), MongoDB (`mongodb`).
- `src/runtime/trinity-crypto.ts`: AES-256-GCM encryption/decryption of database passwords using `MORPHEUS_SECRET`.

### 8.2 Database Registry
Each registered database stores:
- `id`, `name`, `type` (postgres/mysql/sqlite/mongodb)
- `host`, `port`, `database`, `username` (plaintext)
- `password_encrypted` (AES-256-GCM ciphertext)
- `file_path` (SQLite only)
- permission flags: `allow_read`, `allow_insert`, `allow_update`, `allow_delete`, `allow_ddl`
- `schema_cache` (JSON, refreshed on demand)

### 8.3 Task Agent Name
Trinity tasks are stored in the `tasks` table with `agent = 'trinit'` (not `'trinity'`).

## 9. Chronos — Temporal Scheduler

### 9.1 Components
- `src/runtime/chronos/worker.ts`: `ChronosWorker` — polling timer, due-job detection, Oracle execution, and Telegram notification delivery.
- `src/runtime/chronos/repository.ts`: `ChronosRepository` — SQLite-backed job and execution history store. Tables: `chronos_jobs`, `chronos_executions`.
- `src/runtime/chronos/parser.ts`: `parseScheduleExpression` / `parseNextRun` / `intervalToCron` — natural-language schedule parsing, cron normalization, and next-run computation.

### 9.2 Execution Model
- `ChronosWorker` polls the job store at a configurable interval (default 60 s, minimum 60 s).
- Due jobs are executed by calling `oracle.injectAIMessage(context)` then `oracle.chat(job.prompt)` against the currently active Oracle session — no dedicated session is created per job.
- The injected AI message provides job metadata (job ID, execution guard instructions) without incurring an extra LLM call.
- `ChronosWorker.isExecuting` static flag prevents management tools (`chronos_schedule`, `chronos_cancel`) from operating during an active execution to avoid self-deletion or re-scheduling races.
- Delegated tasks spawned during Chronos execution carry `origin_channel: 'telegram'` when a notify function is registered, ensuring completion notifications route correctly.

### 9.3 Schedule Parser
Three schedule types are supported:
- **`once`**: relative durations (`"in 5 minutes"`, `"in 2 hours"`), natural-language dates (`"tomorrow at 9am"`, `"next friday"`), or ISO 8601 timestamps. Stored and computed at creation time.
- **`interval`**: recurring natural-language expressions → normalized to a 5-field cron string stored in `cron_normalized`. Examples: `"every 30 minutes"`, `"every sunday at 9am"`, `"every weekday"`, `"every monday and friday at 8am"`, `"every weekend"`.
- **`cron`**: raw 5-field cron expressions passed through directly (`"*/5 * * * *"`).

### 9.4 Oracle Tools
Oracle exposes four Chronos management tools:
- `chronos_schedule` — create a new job
- `chronos_list` — list all jobs
- `chronos_cancel` — disable or delete a job
- `chronos_preview` — preview next N run timestamps for a given expression

These tools are blocked (`ChronosWorker.isExecuting`) while a Chronos job is executing.

## 10. Security Model
- Local-first storage by default.
- `x-architect-pass` protects `/api/*` management routes.
- webhook trigger uses per-webhook `x-api-key`.
- Telegram allowlist enforces authorized user IDs.
- Apoc execution constrained by configurable `working_dir` and `timeout_ms`.
- Trinity database passwords encrypted at rest with AES-256-GCM (`MORPHEUS_SECRET` env var).
- Per-database permission flags (`allow_read`, `allow_insert`, `allow_update`, `allow_delete`, `allow_ddl`) gate Trinity query execution.

## 11. Runtime Lifecycle
At daemon boot (`start` / `restart` commands):
- load config and initialize Oracle
- start HTTP server (optional)
- connect Telegram (optional)
- start background workers when `runtime.async_tasks.enabled != false`:
  - `TaskWorker`
  - `TaskNotifier`
- start `ChronosWorker` (polls for due scheduled jobs)

Graceful shutdown stops HTTP, adapters, workers, and clears PID state.
