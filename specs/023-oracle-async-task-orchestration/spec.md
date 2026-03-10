# Feature Specification: Oracle Async Task Orchestration + Tasks UI

**Feature Branch**: `023-oracle-async-task-orchestration`
**Created**: 2026-02-19
**Status**: Draft
**Input**: User description: "Mover MCPs/tools para subagentes, Oracle sempre delega (exceto conversa/memória), execução assíncrona por task com worker e visualização de tasks no UI."

## Architectural Constraint (Critical)

- `Oracle` becomes an always-responsive orchestrator.
- `Oracle` never blocks waiting for long-running tool/MCP execution.
- Non-trivial work must be delegated to subagents through persisted async tasks.
- Every task must carry origin context: `origin_channel`, `session_id`, and correlation metadata for reply routing.

## User Scenarios & Testing

### User Story 1 - Immediate Acknowledgement (Priority: P1)

As a user, when I request a task that needs external tools/MCP/devkit, I receive an immediate response confirming the task was accepted and is running.

**Independent Test**: Send a tool-heavy request and verify Oracle returns immediate ACK with `task_id` without waiting for final result.

**Acceptance Scenarios**:

1. **Given** a request requiring tool execution, **When** Oracle classifies it as delegable, **Then** it creates a persisted task and responds immediately with task status `pending`.
2. **Given** many requests in sequence, **When** Oracle receives each one, **Then** none are blocked by prior running tasks.

---

### User Story 2 - Async Worker Execution (Priority: P1)

As a system operator, I need workers to process pending tasks asynchronously and safely update lifecycle states.

**Independent Test**: Seed pending tasks and verify worker transitions `pending -> running -> completed|failed` with output persisted.

**Acceptance Scenarios**:

1. **Given** a pending task, **When** a worker claims it, **Then** task status changes atomically to `running`.
2. **Given** successful subagent execution, **When** processing ends, **Then** task status becomes `completed` with `output` and timestamps.
3. **Given** execution error/timeout, **When** processing fails, **Then** task status becomes `failed` with `error` details.

---

### User Story 3 - Channel-Aware Result Notification (Priority: P1)

As a user, I want final task output delivered back to the same origin channel/session automatically.

**Independent Test**: Create tasks from Web UI and Telegram sessions and verify completion notifications return to correct channel/session.

**Acceptance Scenarios**:

1. **Given** a completed task from Telegram, **When** notifier emits result, **Then** Telegram user receives completion message tied to original session.
2. **Given** a completed task from UI/API, **When** notifier emits result, **Then** UI task state and result panel update correctly.
3. **Given** notifier transient failure, **When** retry policy runs, **Then** notification eventually succeeds or is marked exhausted.

---

### User Story 4 - Tasks Visualization in Dashboard (Priority: P1)

As an operator, I need a dedicated Tasks page to inspect queue health and task details in real time.

**Independent Test**: Open Tasks page and verify list, filters, live refresh, and detail modal reflect backend task state.

**Acceptance Scenarios**:

1. **Given** mixed task statuses, **When** opening Tasks page, **Then** table shows status badges, agent, origin channel, session, created/completed times.
2. **Given** many tasks, **When** applying filters (status/agent/channel/session), **Then** list updates correctly.
3. **Given** a running task, **When** refresh/polling occurs, **Then** UI transitions to `completed` or `failed` without manual reload.

## Edge Cases

- Duplicate processing attempts by multiple workers (must be prevented with atomic claim).
- Daemon restart while tasks are `running` (must requeue or recover stale running tasks).
- Notification channel unavailable (must keep task result persisted and mark notification retry state).
- Long outputs exceeding channel limits (truncate for channel message, keep full output in DB/UI).
- Tasks with missing origin metadata (must be rejected at enqueue validation).

## Requirements

### Functional Requirements

- **FR-001**: Oracle must classify each incoming message into `chat_only` or `delegate_task`.
- **FR-002**: For `delegate_task`, Oracle must create a persisted task with unique `id` and return immediate acknowledgement.
- **FR-003**: Task payload must include `agent`, `input`, `origin_channel`, `session_id`, and optional `origin_message_id`.
- **FR-004**: Worker must claim pending tasks atomically and execute subagents asynchronously.
- **FR-005**: Task lifecycle states must be persisted: `pending`, `running`, `completed`, `failed`, `cancelled`.
- **FR-006**: Completion/failure output must be persisted with timestamps and structured error metadata.
- **FR-007**: Notification service must route final result to origin channel/session.
- **FR-008**: HTTP API must expose task listing, detail, filtering, and aggregate counters.
- **FR-009**: UI must include a Tasks page with status badges, filters, detail view, and auto-refresh.
- **FR-010**: System must preserve Oracle availability under concurrent task load.
- **FR-011**: System must provide retry policy for worker execution and notification delivery.
- **FR-012**: System must emit structured logs correlated by `task_id`, `session_id`, and `origin_channel`.

### Key Entities

- **Task**: Unit of async delegated work.
  - `id`, `agent`, `status`, `input`, `output`, `error`
  - `origin_channel`, `session_id`, `origin_message_id`
  - `attempt_count`, `max_attempts`, `created_at`, `started_at`, `finished_at`, `updated_at`
- **TaskNotification**: Delivery attempts of task result by channel.
  - `task_id`, `channel`, `status`, `attempt_count`, `last_error`, `last_attempt_at`

## Success Criteria

- **SC-001**: 95%+ delegated requests receive ACK response in less than 1s.
- **SC-002**: 100% of completed/failed tasks are persisted with final state and timestamps.
- **SC-003**: No duplicate execution for same task id under multi-worker load tests.
- **SC-004**: Tasks page reflects status transitions within polling interval (<= 5s).
- **SC-005**: Origin-channel notification success rate >= 99% for healthy channels.
