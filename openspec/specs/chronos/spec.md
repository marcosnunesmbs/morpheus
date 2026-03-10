# Chronos Specification

## Purpose
Chronos is the temporal scheduling engine. It allows users to schedule tasks (once, recurring cron, or interval) that Oracle executes automatically at the configured time. Results are broadcast to all registered channel adapters.

## Scope
Included:
- Job types: `once`, `cron`, `interval`
- Schedule parsing and next-run computation
- Background worker polling for due jobs
- Job CRUD and enable/disable via HTTP API
- Execution history with pruning
- Telegram command interface
- Hot-reload of poll interval
- Broadcast of results to all registered channels

Out of scope:
- Oracle execution logic (covered in `oracle` spec)
- Channel delivery (covered in `channels` spec)

## Requirements

### Requirement: Schedule types
The system SHALL support three schedule types:
- **once**: executes at a specific datetime, then auto-disables
- **cron**: standard cron expression (e.g., `0 9 * * 1` = Mondays at 9am)
- **interval**: natural language interval (e.g., `every 30 minutes`, `every 2 hours`) converted internally to a cron expression

#### Scenario: Once job auto-disables after execution
- GIVEN a job of type `once` with a past-due `next_run_at`
- WHEN ChronosWorker executes it
- THEN the job is marked as disabled and no next run is scheduled

#### Scenario: Recurring cron job reschedules
- GIVEN a job of type `cron` with expression `0 9 * * *`
- WHEN ChronosWorker executes it
- THEN `next_run_at` is updated to the next occurrence of `0 9 * * *`

#### Scenario: Interval job converted to cron
- GIVEN a user creates a job with schedule `every 15 minutes`
- WHEN the schedule is parsed
- THEN it is stored internally as the cron expression `*/15 * * * *`

### Requirement: Job execution
The system SHALL detect due jobs on each poll tick and execute them via `oracle.chat()`, tagging delegated tasks with `origin_channel: 'chronos'`.

#### Scenario: Due job executed
- GIVEN a job whose `next_run_at` is in the past and `enabled` is true
- WHEN `ChronosWorker.tick()` runs
- THEN the job's prompt is sent to Oracle
- AND any delegated task is tagged `origin_channel: 'chronos'`

#### Scenario: Re-entrant tick guard
- GIVEN a previous tick is still running
- WHEN a new tick fires
- THEN the new tick exits immediately without executing any jobs

### Requirement: Result broadcast
The system SHALL broadcast Chronos job results to all registered channel adapters via `ChannelRegistry.broadcast()`.

#### Scenario: Result sent to all channels
- GIVEN Telegram and Discord are registered channel adapters
- WHEN a Chronos job completes (via TaskNotifier)
- THEN both Telegram and Discord receive the job result message

### Requirement: max_active_jobs gate
The system SHALL reject new job creation when the number of active (enabled) jobs reaches the configured `max_active_jobs` limit.

#### Scenario: Job limit exceeded
- GIVEN `max_active_jobs` is 10 and 10 jobs are currently enabled
- WHEN a user attempts to create an 11th enabled job
- THEN the system returns an error and no job is created

### Requirement: Hot-reload poll interval
The system SHALL support updating the worker's poll interval at runtime (minimum 60,000ms) without restarting the daemon.

#### Scenario: Interval updated via API
- GIVEN ChronosWorker is running with a 60-second interval
- WHEN `PUT /api/config/chronos` is called with `check_interval_ms: 120000`
- THEN the worker reschedules its timer to 120 seconds

#### Scenario: Interval below minimum rejected
- GIVEN a request to set interval to 30,000ms
- WHEN `updateInterval()` is called
- THEN the update is silently ignored and the current interval remains unchanged

### Requirement: Execution history
The system SHALL record every job execution with start time, end time, status (success/error), and output, accessible via HTTP API.

#### Scenario: Execution recorded
- GIVEN a Chronos job is executed
- WHEN the execution completes
- THEN an execution record is inserted with `status = 'success'` and the result content

#### Scenario: History pruned
- GIVEN a job has more than the configured max execution history records
- WHEN pruning runs
- THEN old records beyond the limit are deleted

### Requirement: Telegram command interface
The system SHALL accept Chronos management commands via Telegram:
- `/chronos <prompt + time>` — create a new job (requires confirmation)
- `/chronos_list` — list all jobs
- `/chronos_view <id>` — view job details
- `/chronos_enable <id>` / `/chronos_disable <id>` — toggle a job
- `/chronos_delete <id>` — delete a job

#### Scenario: Job creation with confirmation
- GIVEN a user sends `/chronos run daily report every day at 8am`
- WHEN Morpheus parses and schedules the job
- THEN it replies with a confirmation summary and awaits the user's `yes`
- AND on confirmation, the job is persisted and enabled

### Requirement: Timezone support
The system SHALL compute `next_run_at` using the configured timezone (default: UTC).

#### Scenario: Job scheduled in local timezone
- GIVEN `chronos.timezone` is `America/Sao_Paulo`
- WHEN a cron job is scheduled for `0 9 * * *`
- THEN `next_run_at` reflects 9am Sao Paulo time (UTC-3)

### Requirement: Self-modification guard
The system SHALL prevent Oracle from deleting or rescheduling the currently-executing Chronos job by checking `ChronosWorker.isExecuting` in management tools.

#### Scenario: Self-delete blocked
- GIVEN a Chronos job prompt instructs Oracle to cancel itself
- WHEN Oracle calls a Chronos management tool during job execution
- THEN the tool returns an error indicating modification is not allowed during execution
