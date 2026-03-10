# Implementation Plan: Oracle Async Task Orchestration + Tasks UI

**Branch**: `023-oracle-async-task-orchestration` | **Date**: 2026-02-19 | **Spec**: [specs/023-oracle-async-task-orchestration/spec.md](specs/023-oracle-async-task-orchestration/spec.md)
**Input**: Feature specification from `/specs/023-oracle-async-task-orchestration/spec.md`

## Summary

Refactor runtime orchestration so Oracle becomes an always-available dispatcher:
- Keep direct answer path only for pure conversation/memory requests.
- Delegate all execution/tool/MCP work by creating persisted async tasks.
- Run subagents in background workers that consume pending tasks.
- Notify users on completion/failure by origin channel.
- Add first-class tasks observability in Web UI.

## Technical Context

**Language/Version**: TypeScript 5.x (Node.js >= 18, ESM)
**Primary Dependencies**: `better-sqlite3`, `express`, React 19 + Vite + SWR
**Storage**: Existing SQLite (`short-memory.db`) with new tasks tables
**Testing**: Vitest (runtime, repository, API, UI behavior)
**Target Platform**: Local daemon (CLI + HTTP + channels)
**Performance Goals**:
- ACK path <= 1s
- Worker claim latency <= 500ms
- UI status freshness <= 5s polling

## Constitution Check

- [x] Local-first persistence for tasks and lifecycle states.
- [x] Extensible agent routing (Apoc/Neo/Trinit future-ready).
- [x] Maintains Oracle orchestration role instead of execution bottleneck.
- [x] Preserves existing channels with explicit origin metadata.

## Scope and Non-Goals

### In Scope

- New `TaskRepository` + schema migration.
- Oracle routing changes to enqueue tasks.
- Background worker loop for async execution.
- Notification dispatcher by origin channel/session.
- HTTP API + UI Tasks page.

### Out of Scope (Phase 1)

- Distributed queue infrastructure.
- External message broker.
- Advanced scheduling/priorities (simple FIFO first).

## Proposed Architecture

1. `OracleRouter` layer
- Classifies intent (`chat_only` vs `delegate_task`).
- Builds `TaskCreateInput` and persists it.
- Returns immediate ACK payload (`task_id`, `status`, `agent`).

2. `TaskRepository` layer
- SQLite tables for `tasks` and optional `task_notifications`.
- Atomic claim query to avoid duplicate worker pickup.
- Query methods for API/UI (filters + counters).

3. `TaskWorker` layer
- Polls pending tasks.
- Claims and executes with selected subagent executor.
- Persists success/failure and emits completion event.

4. `TaskNotifier` layer
- Consumes finished tasks pending delivery.
- Routes completion to `telegram|discord|ui|cli` adapters.
- Handles retry + backoff + exhausted state.

5. UI observability
- New page `/tasks`.
- Status counters, filters, list, and detail modal.
- Auto refresh with SWR polling.

## File-Level Plan

### Runtime

- `src/runtime/types.ts`
  - Extend/introduce interfaces for task enqueue + ack.
- `src/runtime/oracle.ts`
  - Add routing decision and enqueue path.
  - Keep sync chat path for conversation/memory only.
- `src/runtime/tasks/repository.ts` (new)
  - SQLite schema + CRUD + claim/update methods.
- `src/runtime/tasks/worker.ts` (new)
  - Background worker loop and execution lifecycle.
- `src/runtime/tasks/notifier.ts` (new)
  - Channel-aware completion notifications.
- `src/runtime/tasks/types.ts` (new)
  - Shared task domain types.

### HTTP API

- `src/http/api.ts`
  - Add `/tasks` endpoints:
    - `GET /tasks`
    - `GET /tasks/:id`
    - `GET /tasks/stats`
    - optional `POST /tasks/:id/retry`

### Channels

- `src/channels/telegram.ts` (+ future discord)
  - Send immediate ACK with task id when delegated.
  - Add completion message formatting from notifier.

### UI

- `src/ui/src/App.tsx`
  - Register route `/tasks`.
- `src/ui/src/components/Layout.tsx`
  - Add nav item with optional pending badge.
- `src/ui/src/services/tasks.ts` (new)
  - Typed API client for task endpoints.
- `src/ui/src/pages/Tasks.tsx` (new)
  - Table + filters + detail modal + auto refresh.

## Delivery Phases

### Phase 1 - Data and Contracts
- Create task domain types and repository.
- Add schema migration and indexes.

### Phase 2 - Oracle Delegation Flow
- Add classification and enqueue/ack path.
- Preserve direct chat for conversation/memory.

### Phase 3 - Worker Runtime
- Implement polling loop, atomic claim, execution, and persistence.
- Add stale-running recovery strategy on daemon startup.

### Phase 4 - Notification Routing
- Implement notifier worker for channel delivery.
- Add retry/backoff and exhausted state.

### Phase 5 - API + UI Tasks View
- Add tasks endpoints and validation.
- Build tasks page in dashboard and nav integration.

### Phase 6 - Hardening and Tests
- Unit/integration tests for repository, worker, and API.
- UI tests for status rendering and filter behavior.
- Load/concurrency test for claim semantics.

## Risks and Mitigations

- **Race conditions in task claim**: use single SQL atomic update/select pattern and tests.
- **Oracle/session coupling**: carry explicit `session_id` and correlation IDs in task payload.
- **Notification duplication**: persist delivery state and mark-notified atomically.
- **Large outputs for channels**: persist full output; truncate per channel formatter only.

## Rollout Strategy

- Gate by config flag (e.g. `runtime.async_tasks.enabled`).
- Start with single worker process loop.
- Validate in UI with internal telemetry.
- Expand to additional subagents/channels after stability.
