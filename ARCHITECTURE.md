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
| Oracle | Conversation orchestrator and router | `task_query`, `neo_delegate`, `apoc_delegate` |
| Neo | Analytical/operational execution | Runtime MCP tools + config/diagnostic/analytics tools |
| Apoc | DevTools and browser execution | DevKit toolchain |
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
- config management (`/config`, `/config/sati`, `/config/neo`, `/config/apoc`)
- usage statistics and model pricing
- MCP management and reload
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
- Agents settings with dedicated Oracle/Sati/Neo/Apoc tabs.

## 7. Telegram Delivery Model

Telegram adapter uses rich HTML formatting conversion for dynamic responses:
- markdown-like bold/italic/lists/code support
- code blocks and inline code preservation
- UUID auto-wrapping in `<code>` for easier copy

Task completion notifications are proactive and include task metadata (id, agent, status) plus output/error body.

## 8. Security Model
- Local-first storage by default.
- `x-architect-pass` protects `/api/*` management routes.
- webhook trigger uses per-webhook `x-api-key`.
- Telegram allowlist enforces authorized user IDs.
- Apoc execution constrained by configurable `working_dir` and `timeout_ms`.

## 9. Runtime Lifecycle
At daemon boot (`start` / `restart` commands):
- load config and initialize Oracle
- start HTTP server (optional)
- connect Telegram (optional)
- start background workers when `runtime.async_tasks.enabled != false`:
  - `TaskWorker`
  - `TaskNotifier`

Graceful shutdown stops HTTP, adapters, workers, and clears PID state.
