## ADDED Requirements

### Requirement: audit_events table exists in short-memory.db
The system SHALL maintain an `audit_events` table in `short-memory.db` with columns: `id`, `session_id`, `task_id`, `event_type`, `agent`, `tool_name`, `provider`, `model`, `input_tokens`, `output_tokens`, `duration_ms`, `status`, `metadata`, `created_at`.

#### Scenario: Table created on first daemon boot
- **WHEN** the daemon starts for the first time
- **THEN** `audit_events` table exists with all required columns and indexes on `(session_id, created_at)` and `(task_id)`

#### Scenario: Table creation is idempotent
- **WHEN** the daemon restarts with an existing `audit_events` table
- **THEN** no error is raised and existing rows are preserved

---

### Requirement: Subagent LLM calls emit audit events
Every LLM invocation by a subagent (Apoc, Neo, Trinity, Smith) SHALL produce an `audit_events` row with `event_type = 'llm_call'`.

#### Scenario: TaskWorker records audit event after async task completes
- **WHEN** `TaskWorker.executeTask()` completes for agent `'apoc'` with usage data
- **THEN** an `audit_events` row is inserted with `event_type='llm_call'`, `agent='apoc'`, correct `session_id`, `task_id`, `provider`, `model`, `input_tokens`, `output_tokens`, `duration_ms`, `status='success'`

#### Scenario: Failed task emits audit event with error status
- **WHEN** `TaskWorker.executeTask()` throws an exception
- **THEN** an `audit_events` row is inserted with `status='error'` and `metadata` containing the error message

#### Scenario: Sync-mode subagent calls are also recorded
- **WHEN** Oracle calls a subagent in sync mode (inline execution)
- **THEN** Oracle emits an `audit_events` row for the subagent LLM call after it returns

---

### Requirement: DevKit tool invocations emit audit events
Every call to a DevKit tool (filesystem, shell, git, network, packages, processes, system, browser) SHALL produce an `audit_events` row with `event_type = 'tool_call'`.

#### Scenario: Successful tool call recorded
- **WHEN** `shell_execute` is called by Apoc and succeeds
- **THEN** an `audit_events` row is inserted with `event_type='tool_call'`, `tool_name='shell_execute'`, `agent='apoc'`, `duration_ms > 0`, `status='success'`

#### Scenario: Failed tool call recorded
- **WHEN** a DevKit tool throws an error
- **THEN** an `audit_events` row is inserted with `status='error'` and `metadata.error` containing the error message

#### Scenario: Session ID resolved at invocation time
- **WHEN** a tool is invoked
- **THEN** the audit event carries the `session_id` of the agent that invoked it (not the session at tool build time)

---

### Requirement: MCP tool invocations emit audit events
Every call to an MCP tool via Neo SHALL produce an `audit_events` row with `event_type = 'mcp_tool'`.

#### Scenario: MCP tool call recorded with server name
- **WHEN** Neo invokes an MCP tool
- **THEN** an `audit_events` row is inserted with `event_type='mcp_tool'`, `tool_name` as `<server>/<tool>`, `agent='neo'`, `duration_ms`, `status`

---

### Requirement: Keymaker skill executions emit audit events
Every Keymaker skill execution SHALL produce an `audit_events` row with `event_type = 'skill_executed'`.

#### Scenario: Skill execution recorded
- **WHEN** `executeKeymakerTask()` is called for skill `'web-search'`
- **THEN** an `audit_events` row is inserted with `event_type='skill_executed'`, `tool_name='web-search'`, `agent='keymaker'`, `duration_ms`, `status`

---

### Requirement: Chronos job executions emit audit events
Every Chronos job execution SHALL produce an `audit_events` row with `event_type = 'chronos_job'`.

#### Scenario: Chronos execution linked to session
- **WHEN** `ChronosWorker.executeJob()` completes
- **THEN** an `audit_events` row is inserted with `event_type='chronos_job'`, `session_id` from `chronos_executions.session_id`, `tool_name` as the job ID, `duration_ms`, `status`

---

### Requirement: Task lifecycle events emit audit events
Task creation and completion SHALL produce `audit_events` rows for full lifecycle traceability.

#### Scenario: Task creation recorded
- **WHEN** a task is created in `tasks` table
- **THEN** an `audit_events` row is inserted with `event_type='task_created'`, `task_id`, `session_id`, `agent`

#### Scenario: Task completion recorded
- **WHEN** `TaskRepository.markCompleted()` is called
- **THEN** an `audit_events` row is inserted with `event_type='task_completed'`, `task_id`, `duration_ms` (finished_at - started_at), `status='success'`
