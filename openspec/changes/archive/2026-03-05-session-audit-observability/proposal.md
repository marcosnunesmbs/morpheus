## Why

Morpheus orchestrates multiple LLM agents (Oracle, Apoc, Neo, Trinity, Smith), DevKit tools, MCP tools, and Chronos jobs — but there is no unified way to audit what happened in a session: which agents ran, which tools were called, how long each step took, and what it cost. Token usage is only tracked for Oracle's direct LLM calls; subagent tokens, tool latencies, and task-level costs are invisible. This makes debugging, cost attribution, and performance analysis impossible.

## What Changes

- **Phase 1 — Enrich existing tables**: Add `agent`, `duration_ms` columns to `messages`; add `provider`, `model`, `input_tokens`, `output_tokens`, `duration_ms`, `step_count` to `tasks`. Make subagents (Apoc, Neo, Trinity, Smith) persist their LLM calls to the `messages` table with the correct `agent` tag.
- **Phase 2 — Audit events table + instrumentation**: New `audit_events` table capturing every auditable event (llm_call, tool_call, task_created/completed, skill_executed, chronos_job) with session/task linkage, agent, tool_name, provider, model, tokens, duration, status. Instrument DevKit tools and MCP tools to emit audit events.
- **Phase 3 — Audit page**: New frontend page `/sessions/:id/audit` showing a full session timeline with costs computed from `model_pricing`. Includes per-agent breakdown, per-tool breakdown, total cost, and exportable audit log (JSON/CSV).
- **Phase 4 — Enhanced chat UI**: Improve the chat view to show tool calls and subagent work inline, collapsed by default, with expandable detail sections showing tool name, args, result, duration, and token metadata.

## Capabilities

### New Capabilities

- `session-messages-enrichment`: Enrich `messages` and `tasks` tables with agent attribution, duration tracking, and subagent token capture. Add backend stats endpoints for per-agent breakdowns.
- `audit-events`: New `audit_events` table and instrumentation layer that records every LLM call, tool invocation, task lifecycle event, and skill execution linked to a session.
- `session-audit-page`: Frontend page `/sessions/:id/audit` — session timeline, cost breakdown by agent/tool/model, total estimated cost, and export capabilities.
- `chat-tool-visualization`: Enhanced chat UI with collapsible inline sections for tool calls, subagent delegations, and step-by-step agent reasoning, including token and timing metadata.

### Modified Capabilities

<!-- None — all new -->

## Impact

**Backend:**
- `src/runtime/memory/sqlite.ts` — migrations for `messages` (agent, duration_ms), `tasks` (provider, model, tokens, duration_ms, step_count), new `audit_events` table
- `src/runtime/oracle.ts` — inject `agent: 'oracle'` and `duration_ms` on messages; emit audit events for tool calls
- `src/runtime/apoc.ts`, `neo.ts`, `trinity.ts` — persist LLM calls to `messages` with `agent` tag; report usage + duration when returning task results
- `src/runtime/smiths/delegator.ts` — report tokens and duration back to task
- `src/runtime/tasks/worker.ts` — propagate provider/model/tokens/duration to `tasks` table on completion
- `src/runtime/chronos/worker.ts` — emit audit events for job executions
- `src/devkit/tools/*.ts` — wrap tool execute with duration + status tracking
- `src/runtime/tools/factory.ts` (MCP) — wrap MCP tool calls with audit event emission
- `src/http/api.ts` — new endpoints: `GET /api/sessions/:id/audit`, `GET /api/stats/usage/by-agent`

**Frontend:**
- `src/ui/src/pages/` — new `SessionAudit.tsx` page
- `src/ui/src/pages/Chat.tsx` — enhanced message rendering with collapsible tool/agent blocks
- `src/ui/src/services/` — new `audit.ts` service (SWR hooks)
- `src/ui/src/components/chat/` — new components: `ToolCallBlock`, `AgentBlock`, `MessageMeta`
- Router — add `/sessions/:id/audit` route

**Dependencies:** None new — uses existing SQLite, React, Tailwind, framer-motion.
