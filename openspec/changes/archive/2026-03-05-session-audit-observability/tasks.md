# Tasks: session-audit-observability

---

## 1. Phase 1 — DB Schema: Enrich messages + tasks tables

- [x] 1.1 Add `agent TEXT DEFAULT 'oracle'` column to `messages` in `migrateTable()` in `src/runtime/memory/sqlite.ts`
- [x] 1.2 Add `duration_ms INTEGER` column to `messages` in `migrateTable()` in `src/runtime/memory/sqlite.ts`
- [x] 1.3 Add `provider TEXT`, `model TEXT`, `input_tokens INTEGER DEFAULT 0`, `output_tokens INTEGER DEFAULT 0`, `duration_ms INTEGER`, `step_count INTEGER DEFAULT 0` columns to `tasks` in `migrateTasksTable()` in `src/runtime/tasks/repository.ts`
- [x] 1.4 Update `TaskRepository.markCompleted()` signature to accept optional usage metadata and persist new columns
- [x] 1.5 Update `GET /api/sessions/:id/messages` response to include `agent` and `duration_ms` fields

## 2. Phase 1 — Subagent AgentResult return type

- [x] 2.1 Define `AgentUsage` and `AgentResult` interfaces in `src/runtime/tasks/types.ts`
- [x] 2.2 Refactor `Apoc.execute()` to return `AgentResult` — measure wall-clock time, extract `usage_metadata` from ReactAgent response messages, count step iterations
- [x] 2.3 Refactor `Neo.execute()` to return `AgentResult` — same pattern as Apoc
- [x] 2.4 Refactor `Trinity.execute()` to return `AgentResult` — same pattern as Apoc
- [x] 2.5 Refactor `SmithDelegator.delegate()` to return `AgentResult` — populate usage if WebSocket response includes it, otherwise zeros
- [x] 2.6 Update `TaskWorker.executeTask()` to destructure `AgentResult`, pass usage to `TaskRepository.markCompleted()`
- [x] 2.7 Update `executeKeymakerTask()` to return `AgentResult` — measure duration, no tokens (skill, not LLM)

## 3. Phase 1 — Oracle duration tracking + agent tag

- [x] 3.1 In `Oracle.chat()`, record `startMs = Date.now()` before invoking the ReactAgent and compute `duration_ms` after
- [x] 3.2 Pass `duration_ms` to `addMessage()` when persisting Oracle's AI response
- [x] 3.3 Update `SQLiteChatMessageHistory.addMessage()` to accept and store `duration_ms`

## 4. Phase 1 — Stats API: per-agent breakdown

- [x] 4.1 Add `getUsageStatsByAgent()` method to `SQLiteChatMessageHistory` — queries `messages` (agent=oracle) + `audit_events` (event_type=llm_call) UNION, groups by `agent`, joins `model_pricing` for cost
- [x] 4.2 Register `GET /api/stats/usage/by-agent` endpoint in `src/http/api.ts`

## 5. Phase 2 — audit_events table

- [x] 5.1 Add `audit_events` table creation SQL to `TaskRepository.ensureTables()` (same DB file, same connection lifecycle)
- [x] 5.2 Add indexes on `(session_id, created_at)` and `(task_id)`
- [x] 5.3 Create `AuditRepository` singleton in `src/runtime/audit/repository.ts` with methods: `insert(event)`, `getBySession(sessionId, opts?)`, `getSessionSummary(sessionId)`
- [x] 5.4 Define `AuditEvent` and `AuditEventInsert` types in `src/runtime/audit/types.ts`

## 6. Phase 2 — Emit audit events from TaskWorker

- [x] 6.1 In `TaskWorker.executeTask()`, emit `task_created` audit event when task execution begins
- [x] 6.2 In `TaskWorker.executeTask()`, emit `task_completed` audit event on success with `duration_ms`, `status='success'`
- [x] 6.3 In `TaskWorker.executeTask()`, emit `task_completed` audit event on failure with `status='error'`, `metadata.error`
- [x] 6.4 In `TaskWorker.executeTask()`, emit `llm_call` audit event for each subagent that returned usage (apoc/neo/trinity/smith)

## 7. Phase 2 — DevKit tool instrumentation

- [x] 7.1 Create `instrumentTool(tool, getSessionId)` wrapper function in `src/devkit/index.ts`
- [x] 7.2 Apply `instrumentTool` to every tool returned by `buildDevKit()` — wrap `_call()` with timing and AuditRepository.insert()
- [x] 7.3 Pass a `getSessionId` getter to `buildDevKit()` that resolves the current agent's static `currentSessionId` at invocation time

## 8. Phase 2 — MCP tool instrumentation

- [x] 8.1 In `Construtor.create()` (MCP factory), wrap each MCP tool with the same `instrumentTool` pattern, setting `event_type = 'mcp_tool'` and `tool_name = '<server>/<tool>'`
- [x] 8.2 Pass Neo's `getSessionId` getter into the MCP tool wrapper

## 9. Phase 2 — Keymaker and Chronos audit events

- [x] 9.1 Wrap `executeKeymakerTask()` in `TaskWorker` to emit `skill_executed` audit event with tool_name = skill name, duration_ms, status
- [x] 9.2 In `ChronosWorker.executeJob()`, emit `chronos_job` audit event before and after Oracle.chat() call with session_id from chronos_executions, duration_ms, status

## 10. Phase 2 — Sync-mode subagent audit events

- [x] 10.1 In `Oracle.chat()`, detect when a sync-mode delegation result is returned inline
- [x] 10.2 Emit `llm_call` audit event for sync-mode Apoc/Neo/Trinity/Smith calls with session_id, agent, usage data from AgentResult

## 11. Phase 2 — Audit API endpoint

- [x] 11.1 Implement `AuditRepository.getBySession(sessionId)` — returns all events ordered by `created_at`, joins `model_pricing` for `estimated_cost_usd` per event
- [x] 11.2 Implement `AuditRepository.getSessionSummary(sessionId)` — returns `{ totalCostUsd, byAgent[], byModel[], toolCallCount, llmCallCount, totalDurationMs }`
- [x] 11.3 Register `GET /api/sessions/:id/audit` endpoint in `src/http/api.ts` — returns `{ events[], summary }`

## 12. Phase 3 — Session Audit page (frontend)

- [x] 12.1 Create `src/ui/src/services/audit.ts` — SWR hook `useSessionAudit(sessionId)` calling `GET /api/sessions/:id/audit`
- [x] 12.2 Create `src/ui/src/components/audit/EventRow.tsx` — renders a single `audit_events` row with icon, agent badge, tool/model info, duration, status, cost
- [x] 12.3 Create `src/ui/src/components/audit/EventTimeline.tsx` — renders ordered list of `EventRow`, groups tool/llm events under their parent task row
- [x] 12.4 Create `src/ui/src/components/audit/CostSummaryPanel.tsx` — sticky right-side panel with total cost, by-agent table, by-model table, tool invocation counts
- [x] 12.5 Create `src/ui/src/components/audit/ExportButton.tsx` — dropdown with "Export JSON" and "Export CSV" actions, derives data from `useSessionAudit`
- [x] 12.6 Create `src/ui/src/pages/SessionAudit.tsx` — two-column layout: `EventTimeline` (70%) + `CostSummaryPanel` (30%), uses `useParams` for session ID, includes `ExportButton`
- [x] 12.7 Register `/sessions/:id/audit` route in `src/ui/src/App.tsx` (or router file)
- [x] 12.8 Add "Audit" action to session list / chat sidebar session context menu in `SessionList.tsx`
- [x] 12.9 Apply dual-theme tokens to all audit page components (dark: bg-black inputs, border-matrix-primary, text-matrix-secondary, etc.)
- [x] 12.10 Add pagination (100 events/page) to `EventTimeline` for long sessions

## 13. Phase 4 — Chat tool call visualization

- [x] 13.1 Define `GroupedMessage` type and implement `groupMessages(messages[])` utility in `src/ui/src/services/chat.ts`
- [x] 13.2 Create `src/ui/src/components/chat/ToolCallBlock.tsx` — collapsible block with framer-motion animation; header shows tool name(s) + status icons; expanded view shows args JSON + result + duration
- [x] 13.3 Create `src/ui/src/components/chat/AgentBlock.tsx` — specialized block for `apoc_delegate` / `neo_delegate` / `trinity_delegate` / `smith_delegate` calls; shows agent name, task preview, step count, token summary, cost, spinner when in-progress
- [x] 13.4 Create `src/ui/src/components/chat/MessageMeta.tsx` — collapsible footer for AI messages showing provider badge, model name, token counts, duration, estimated cost
- [x] 13.5 Update `ChatArea.tsx` (or the message rendering component) to use `groupMessages()` and render `ToolCallBlock` / `AgentBlock` / `MessageMeta` instead of raw tool messages
- [x] 13.6 Fetch audit events for the active session in `ChatPage` (or `ChatArea`) and pass token/duration metadata to `AgentBlock` and `MessageMeta`
- [x] 13.7 Apply dual-theme tokens to `ToolCallBlock`, `AgentBlock`, `MessageMeta` (dark: bg-zinc-900 content areas, border-matrix-primary, text-matrix-secondary for body, text-matrix-highlight for names)
- [x] 13.8 Test collapsible behavior: all blocks collapsed by default, expand/collapse on click, correct animation with framer-motion `AnimatePresence`
