# Audit Specification

## Purpose
The audit system records a structured event trail for every Oracle session — LLM calls, tool executions, task lifecycle transitions, and errors. Audit data powers the Session Audit UI, cost summaries, and per-agent usage analysis.

## Scope
Included:
- AuditRepository: event insert, session summary, global summary
- Event types: `task_created`, `task_completed`, `llm_call`, `tool_call`
- Session audit HTTP API
- Audit Dashboard UI (session list with costs)
- Session Audit UI (per-session timeline + cost summary)

Out of scope:
- Task execution mechanics (covered in `tasks` spec)
- Token usage tracking in messages table (covered in `memory` spec)

## Requirements

### Requirement: Audit event recording
The system SHALL record audit events in the `audit_events` table with: session ID, optional task ID, event type, agent, tool name (for tool calls), provider/model/tokens (for LLM calls), duration, status, and optional metadata JSON.

#### Scenario: Task lifecycle events recorded
- GIVEN a task is executed by Apoc
- WHEN the task starts and finishes
- THEN two events are inserted: `task_created` (status=success) and `task_completed` (status=success or error)

#### Scenario: LLM call event recorded
- GIVEN a task completes with non-zero token usage
- WHEN TaskWorker processes the result
- THEN an `llm_call` event is inserted with `provider`, `model`, `input_tokens`, `output_tokens`, and `duration_ms`

#### Scenario: Tool call event recorded
- GIVEN a subagent executes a DevKit or MCP tool
- WHEN the tool completes (via DevKit instrument wrapper)
- THEN a `tool_call` event is inserted with `tool_name`, `agent`, `duration_ms`, and `status`

### Requirement: Agent resolution
The system SHALL resolve the display audit agent name from the task's `agent` key via `SubagentRegistry.resolveAuditAgent()` (e.g., `'trinit'` → `'trinity'`).

#### Scenario: Trinity agent resolved
- GIVEN a task with `agent = 'trinit'`
- WHEN the audit event is inserted
- THEN `agent` field is set to `'trinity'`

### Requirement: Session audit summary
The system SHALL compute per-session summaries including: total LLM calls, total tool calls, total tokens, total cost (based on model pricing), and breakdown by agent.

#### Scenario: Session summary computed
- GIVEN a session with 5 LLM calls (3 Oracle, 2 Apoc) and 10 tool calls
- WHEN `GET /api/audit/sessions/:id/summary` is called
- THEN the response includes total counts, per-agent breakdown, and estimated cost

### Requirement: Global audit dashboard
The system SHALL provide aggregated audit statistics across all sessions for the dashboard.

#### Scenario: Dashboard shows all sessions
- GIVEN 10 sessions exist with varying agent activity
- WHEN `GET /api/audit/sessions` is called
- THEN all sessions are returned with their per-session cost and agent summary

### Requirement: Session Audit UI — timeline
The system SHALL display audit events for a session as a chronological timeline in the Session Audit page (`/sessions/:id/audit`), showing per-event: agent badge, event type, status, tokens, duration, and estimated cost.

#### Scenario: Timeline auto-scrolls to latest
- GIVEN new events arrive for an active session
- WHEN the audit page is open
- THEN the timeline scrolls to the bottom automatically

### Requirement: Session Audit UI — cost summary panel
The system SHALL display a cost summary panel alongside the timeline showing totals and per-model breakdown.

#### Scenario: Per-model breakdown shown
- GIVEN a session used both `claude-3-5-sonnet` and `gpt-4o`
- WHEN the cost summary panel is rendered
- THEN both models appear with their respective call counts, tokens, and estimated cost

### Requirement: Audit export
The system SHALL allow exporting a session's audit events as JSON or CSV.

#### Scenario: JSON export
- GIVEN a session with 20 audit events
- WHEN the user clicks the Export button in the Session Audit page
- THEN a JSON file is downloaded containing all events for that session
## ADDED Requirements

### Requirement: Unified Global Usage Statistics
The system SHALL provide a unified global usage summary derived exclusively from the `audit_events` and `model_pricing` tables to ensure consistency across all reporting interfaces.

#### Scenario: Global stats use Audit data
- **WHEN** the `/api/stats/usage` endpoint is called
- **THEN** the response SHALL be derived from `AuditRepository.getGlobalSummary().totals`.

#### Scenario: Grouped stats use Audit data
- **WHEN** the `/api/stats/usage/grouped` endpoint is called
- **THEN** the response SHALL be derived from `AuditRepository.getGlobalSummary().byModel`.

#### Scenario: Agent stats use Audit data
- **WHEN** the `/api/stats/usage/by-agent` endpoint is called
- **THEN** the response SHALL be derived from `AuditRepository.getGlobalSummary().byAgent`.

### Requirement: Complete Audit Coverage for Subagents
All subagent LLM calls MUST be recorded as `llm_call` events in the `audit_events` table to ensure global statistics are complete.

#### Scenario: Subagent LLM call audited
- **WHEN** a subagent (Apoc, Neo, Trinity, Smith, Link) completes an LLM invocation
- **THEN** an `llm_call` event MUST be inserted into the `audit_events` table with accurate token usage and duration.
