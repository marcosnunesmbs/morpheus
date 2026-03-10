## ADDED Requirements

### Requirement: Session audit page accessible at /sessions/:id/audit
The dashboard SHALL expose a page at `/sessions/:id/audit` showing the full audit trail for a session.

#### Scenario: Page loads from session list
- **WHEN** user opens `/sessions/:id/audit` for a valid session ID
- **THEN** the page renders the session title, event timeline, and cost summary panel

#### Scenario: Unknown session shows empty state
- **WHEN** user opens `/sessions/:id/audit` for a session with no audit events
- **THEN** the page shows an empty state message: "No audit events recorded for this session."

---

### Requirement: Audit page shows chronological event timeline
The timeline SHALL display all `audit_events` for the session ordered by `created_at` ascending, with one row per event.

#### Scenario: Event row shows type icon, agent, tool name, and duration
- **WHEN** an event of type `tool_call` is rendered
- **THEN** the row shows: icon (wrench), agent badge (`apoc`), tool name (`shell_execute`), duration (`124ms`), status indicator (green/red)

#### Scenario: LLM call event shows provider, model, and token counts
- **WHEN** an event of type `llm_call` is rendered
- **THEN** the row shows: icon (brain), agent badge, provider/model label, `in: 320 / out: 180 tokens`, duration, estimated cost

#### Scenario: Task lifecycle events grouped visually
- **WHEN** a `task_created` event is followed by `tool_call` and `llm_call` events with the same `task_id`
- **THEN** the tool and llm events are visually indented under the task header row

#### Scenario: Events are paginated for long sessions
- **WHEN** a session has more than 100 audit events
- **THEN** the timeline shows 100 events per page with next/previous controls

---

### Requirement: Audit page shows cost summary panel
The right-side panel SHALL display a cost breakdown for the session, computed server-side.

#### Scenario: Total session cost displayed
- **WHEN** the audit page loads
- **THEN** the summary panel shows `Total estimated cost: $X.XXXX` computed from all `llm_call` events joined with `model_pricing`

#### Scenario: Cost breakdown by agent
- **WHEN** the summary panel renders
- **THEN** it shows a table with one row per `agent` that made LLM calls: agent name, token counts, estimated cost

#### Scenario: Cost breakdown by model
- **WHEN** the summary panel renders
- **THEN** it shows a table with one row per `provider/model` combination: model name, total tokens, cost per 1M, estimated cost

#### Scenario: Tool invocation summary
- **WHEN** the summary panel renders
- **THEN** it shows total DevKit tool calls, MCP tool calls, skill executions — with counts and total duration — but no cost (tools are free)

#### Scenario: Model has no pricing entry
- **WHEN** a model in `audit_events` has no matching row in `model_pricing`
- **THEN** the cost is shown as `$0.00` with a note "(no pricing data)"

---

### Requirement: Audit page supports export
The page SHALL allow exporting the session audit log.

#### Scenario: Export as JSON
- **WHEN** user clicks "Export JSON"
- **THEN** browser downloads a `.json` file containing all `audit_events` for the session plus the cost summary

#### Scenario: Export as CSV
- **WHEN** user clicks "Export CSV"
- **THEN** browser downloads a `.csv` file with columns: `created_at`, `event_type`, `agent`, `tool_name`, `provider`, `model`, `input_tokens`, `output_tokens`, `duration_ms`, `status`, `estimated_cost_usd`

---

### Requirement: Backend audit endpoint returns events with cost data
`GET /api/sessions/:id/audit` SHALL return all audit events for a session enriched with `estimated_cost_usd`.

#### Scenario: Response includes per-event cost
- **WHEN** `GET /api/sessions/:id/audit` is called
- **THEN** each `llm_call` event in the response includes `estimated_cost_usd` computed from `(input_tokens / 1_000_000 * input_price) + (output_tokens / 1_000_000 * output_price)`

#### Scenario: Response includes session-level summary
- **WHEN** `GET /api/sessions/:id/audit` is called
- **THEN** the response body includes a `summary` object with `totalCostUsd`, `byAgent[]`, `byModel[]`, `toolCallCount`, `llmCallCount`, `totalDurationMs`

#### Scenario: Missing pricing returns zero cost, not error
- **WHEN** an `audit_event` references a model not in `model_pricing`
- **THEN** `estimated_cost_usd = 0` for that event, no 404 or 500

---

### Requirement: Audit page is accessible from the Sessions list
The sessions list or chat sidebar SHALL include a link to the audit page for each session.

#### Scenario: Audit link in session dropdown or actions menu
- **WHEN** user right-clicks or opens the actions menu for a session
- **THEN** an "Audit" option is shown that navigates to `/sessions/:id/audit`
