# Tasks: Oracle Async Task Orchestration + Tasks UI

**Input**: Design docs from `/specs/023-oracle-async-task-orchestration/`
**Prerequisites**: `spec.md`, `plan.md`

## Phase 1: Foundation (Data + Domain)

- [ ] T001 Create `src/runtime/tasks/types.ts` with task status, payload, and DTO contracts.
- [ ] T002 Create `src/runtime/tasks/repository.ts` with SQLite schema initialization for `tasks` and indexes.
- [ ] T003 Implement repository methods: `createTask`, `claimNextPending`, `markRunning`, `markCompleted`, `markFailed`, `listTasks`, `getTaskById`, `getStats`.
- [ ] T004 Add startup migration wiring so task tables exist before runtime services boot.

## Phase 2: Oracle Routing and ACK

- [ ] T005 Update `src/runtime/oracle.ts` to classify messages into `chat_only` vs `delegate_task`.
- [ ] T006 Implement enqueue path returning immediate ACK text containing `task_id`.
- [ ] T007 Preserve existing sync chat/memory behavior for pure conversation paths.
- [ ] T008 Update `src/runtime/types.ts` interfaces if needed for task-aware responses.

## Phase 3: Worker Execution

- [ ] T009 Create `src/runtime/tasks/worker.ts` to poll pending tasks and claim atomically.
- [ ] T010 Add subagent executor mapping (`apoc`, `neo`, `trinit`) and run lifecycle updates.
- [ ] T011 Implement timeout/retry policy (`attempt_count`, max attempts, backoff).
- [ ] T012 Implement stale `running` recovery on startup.

## Phase 4: Notification Flow

- [ ] T013 Create `src/runtime/tasks/notifier.ts` to dispatch completion by `origin_channel`.
- [ ] T014 Integrate Telegram completion messaging using existing adapter integration points.
- [ ] T015 Persist notification attempts/errors and avoid duplicate sends.

## Phase 5: API Endpoints

- [ ] T016 Add `GET /api/tasks` with filters (`status`, `agent`, `origin_channel`, `session_id`, `limit`, `cursor`).
- [ ] T017 Add `GET /api/tasks/:id` for detailed payload/result.
- [ ] T018 Add `GET /api/tasks/stats` for dashboard counters.
- [ ] T019 Add optional `POST /api/tasks/:id/retry` for failed tasks.

## Phase 6: Dashboard Tasks UI

- [ ] T020 Create `src/ui/src/services/tasks.ts` API client and types.
- [ ] T021 Create `src/ui/src/pages/Tasks.tsx` with:
  - status counters
  - filter controls
  - live table (polling)
  - detail modal (input/output/error)
- [ ] T022 Register route in `src/ui/src/App.tsx` and add nav item in `src/ui/src/components/Layout.tsx`.
- [ ] T023 Add task badge indicator (pending/running) in sidebar for quick queue visibility.

## Phase 7: Testing and Hardening

- [ ] T024 Unit tests for repository atomic claim and lifecycle transitions.
- [ ] T025 Integration test for Oracle enqueue + immediate ACK behavior.
- [ ] T026 Integration test for worker execution and final notification dispatch.
- [ ] T027 API tests for task filtering and stats correctness.
- [ ] T028 UI tests for status rendering, polling updates, and filters.

## Phase 8: Rollout

- [ ] T029 Add config feature flag `runtime.async_tasks.enabled` and safe fallback.
- [ ] T030 Document operational runbook (worker lifecycle, retries, troubleshooting).
- [ ] T031 Enable by default after validation in local/manual stress testing.
