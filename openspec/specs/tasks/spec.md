# Tasks Specification

## Purpose
The task queue system provides asynchronous execution of delegated subagent work. Tasks are persisted in SQLite, executed by TaskWorker with concurrency control and automatic retry, and results are delivered back to the originating channel via TaskNotifier.

## Scope
Included:
- Task lifecycle: pending → running → completed / failed
- TaskWorker: polling, concurrency cap, stale recovery
- Retry with exponential backoff
- TaskNotifier: result delivery to originating channel
- Audit event emission for task lifecycle
- TaskRepository: CRUD operations

Out of scope:
- Subagent execution logic (covered in `subagents` spec)
- Channel delivery mechanics (covered in `channels` spec)
- Audit event schema (covered in `audit` spec)

## Requirements

### Requirement: Task creation
The system SHALL create a task record when a delegation tool is called in async mode, persisting: input, agent key, origin channel, session ID, origin user ID, and optional origin message ID.

#### Scenario: Async delegation enqueues task
- GIVEN `apoc.execution_mode` is `async`
- WHEN Oracle calls `apoc_delegate` with a task
- THEN a task record is inserted with `status = 'pending'` and `agent = 'apoc'`

#### Scenario: Delegation failure response
- GIVEN the task insert fails (DB error)
- WHEN Oracle's delegation tool returns
- THEN Oracle responds with "Task enqueue could not be confirmed in the database. No task was created. Please retry."

### Requirement: Task polling and claiming
The system SHALL poll the tasks table at a configurable interval (default 300ms), atomically claiming the next pending task for the worker's ID, up to the configured concurrency limit (default 3).

#### Scenario: Task claimed by worker
- GIVEN a pending task exists in the queue
- WHEN TaskWorker's tick fires
- THEN the task is atomically claimed (status = 'running', worker_id set) and execution begins

#### Scenario: Concurrency cap respected
- GIVEN 3 tasks are already running (at the default `maxConcurrent = 3`)
- WHEN the next tick fires
- THEN no additional task is claimed until a running task completes

### Requirement: Stale task recovery
The system SHALL recover tasks stuck in `running` state for longer than `staleRunningMs` (default 5 minutes) on worker startup, resetting them to `pending`.

#### Scenario: Stale tasks recovered at startup
- GIVEN 2 tasks have been in `running` state for 6 minutes (from a previous crash)
- WHEN TaskWorker starts
- THEN both tasks are reset to `pending` and a warning is logged

### Requirement: Retry with exponential backoff
The system SHALL retry failed tasks up to `max_attempts` times with exponential backoff (1s, 2s, 4s... capped at 30s).

#### Scenario: Task retried after failure
- GIVEN a task fails on attempt 1 of 3
- WHEN the error is caught
- THEN the task is requeued with `next_run_at = now + 1000ms` (backoff for attempt 1)
- AND `attempt_count` is incremented

#### Scenario: Task permanently fails
- GIVEN a task fails on its final attempt (attempt_count == max_attempts)
- WHEN the error is caught
- THEN the task is marked `failed` with the error message
- AND an `task_completed` audit event with `status = 'error'` is emitted

### Requirement: Result delivery
The system SHALL deliver task results to the originating channel via TaskNotifier after successful completion.

#### Scenario: Result delivered to Telegram user
- GIVEN a task originated from Telegram, user ID `12345`, session `sess-abc`
- WHEN the task completes successfully
- THEN TaskNotifier calls `ChannelRegistry.sendToUser('telegram', '12345', result)`

#### Scenario: Chronos task result broadcast
- GIVEN a task has `origin_channel = 'chronos'`
- WHEN the task completes
- THEN `ChannelRegistry.broadcast(result)` is called (sent to all registered channels)

#### Scenario: UI task result stored
- GIVEN a task has `origin_channel = 'ui'`
- WHEN the task completes
- THEN the result is written to the SQLite session history (no external notification)

### Requirement: Audit events
The system SHALL emit audit events for task lifecycle transitions:
- `task_created` — when execution begins
- `task_completed` (success or error) — when finished
- `llm_call` — if the result includes token usage data

#### Scenario: Full audit trail for completed task
- GIVEN a task executes successfully with token usage
- WHEN the task finishes
- THEN three audit events are inserted: `task_created`, `task_completed`, `llm_call`

### Requirement: Task query tool
The system SHALL provide Oracle with a `task_query` tool to look up the status and result of previously created tasks.

#### Scenario: Oracle queries task status
- GIVEN a task was enqueued with ID `task-123`
- WHEN Oracle calls `task_query` with that ID
- THEN the current status and output (if completed) are returned
