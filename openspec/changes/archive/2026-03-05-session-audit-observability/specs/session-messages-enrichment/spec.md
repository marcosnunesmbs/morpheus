## ADDED Requirements

### Requirement: messages table carries agent attribution
Every row in the `messages` table SHALL include an `agent` column identifying which agent produced it.

#### Scenario: Oracle message stored with agent tag
- **WHEN** Oracle persists an AI response via `addMessage()`
- **THEN** the row has `agent = 'oracle'`

#### Scenario: Subagent message stored with correct agent tag
- **WHEN** an `audit_events` row is written for a subagent LLM call
- **THEN** the row carries the agent name (e.g. `'apoc'`, `'neo'`, `'trinity'`, `'smith'`)

#### Scenario: Legacy rows default to oracle
- **WHEN** the migration runs on an existing DB
- **THEN** all pre-existing `messages` rows have `agent = 'oracle'` (column DEFAULT)

---

### Requirement: messages table tracks response duration
Every AI message row in `messages` SHALL include a `duration_ms` column with the wall-clock time from request dispatch to first token received (or full response for non-streaming).

#### Scenario: Oracle measures and stores duration
- **WHEN** Oracle's `chat()` method completes an LLM call
- **THEN** the resulting `ai` message row has `duration_ms > 0`

#### Scenario: Missing duration is nullable
- **WHEN** duration cannot be measured (legacy or error path)
- **THEN** `duration_ms` IS NULL — no error is raised

---

### Requirement: tasks table carries LLM attribution
The `tasks` table SHALL include columns `provider`, `model`, `input_tokens`, `output_tokens`, `duration_ms`, and `step_count` for every completed async task.

#### Scenario: TaskWorker writes usage on completion
- **WHEN** a subagent's `execute()` returns an `AgentResult` with a `usage` field
- **THEN** `TaskRepository.markCompleted()` persists `provider`, `model`, `input_tokens`, `output_tokens`, `duration_ms`, `step_count` to the task row

#### Scenario: Tasks without usage data remain valid
- **WHEN** a subagent returns no `usage` (e.g. Keymaker skill, Smith without telemetry)
- **THEN** the task row has `input_tokens = 0`, `output_tokens = 0`, `step_count = 0`, `duration_ms = NULL`

#### Scenario: Migration is non-destructive
- **WHEN** the daemon starts with an existing `tasks` table missing the new columns
- **THEN** `migrateTasksTable()` adds all six columns with safe defaults and the daemon boots normally

---

### Requirement: Subagent execute() returns structured AgentResult
Apoc, Neo, Trinity, and Smith `execute()` SHALL return `{ output: string; usage?: AgentUsage }` instead of `string`.

#### Scenario: Apoc returns usage after task execution
- **WHEN** `Apoc.execute()` completes
- **THEN** the returned object includes `usage.provider`, `usage.model`, `usage.inputTokens`, `usage.outputTokens`, `usage.durationMs`, `usage.stepCount`

#### Scenario: Fallback when usage is unavailable
- **WHEN** the LLM response does not include usage metadata
- **THEN** `execute()` returns `{ output, usage: undefined }` and TaskWorker stores zeros

---

### Requirement: Stats API exposes per-agent token breakdown
`GET /api/stats/usage/by-agent` SHALL return aggregated token usage and estimated cost grouped by `agent`.

#### Scenario: Returns data for all agents that consumed tokens
- **WHEN** `GET /api/stats/usage/by-agent` is called
- **THEN** the response is an array where each entry has `agent`, `totalInputTokens`, `totalOutputTokens`, `messageCount`, `estimatedCostUsd`

#### Scenario: Data from both messages and audit_events
- **WHEN** Oracle tokens are in `messages` and subagent tokens are in `audit_events`
- **THEN** the endpoint merges both sources, deduplicates by agent, and returns a unified breakdown
