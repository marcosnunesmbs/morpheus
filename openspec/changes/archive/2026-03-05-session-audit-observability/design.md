## Context

Morpheus routes work through a multi-layer agent stack: Oracle (root LLM) → subagents (Apoc, Neo, Trinity, Smith, Keymaker) → tools (DevKit, MCP). Each layer can invoke its own LLM, call multiple tools, and create tasks in the queue. Today:

- Only Oracle's messages land in `messages` table with token metadata.
- Subagent LLM calls are invisible — their tokens are consumed but never recorded.
- Tool invocations exist only as serialized JSON blobs inside `messages.content`.
- `tasks` knows status but not cost, duration, or step count.
- There is no unified per-session view of "what ran, how long, how much."

The four phases address these gaps incrementally, from DB schema up to UI.

## Goals / Non-Goals

**Goals:**
- G1: Every LLM call (Oracle + all subagents) is attributed to a session with provider/model/tokens.
- G2: Every tool invocation (DevKit, MCP, Keymaker skill) is recorded with name, duration, status.
- G3: A session audit page shows a chronological event timeline with cost breakdown.
- G4: The chat UI renders tool calls and agent work inline, collapsed by default.
- G5: All new columns use the existing `migrateTable()` / `addColumn()` pattern — zero-downtime.

**Non-Goals:**
- No distributed tracing (no OpenTelemetry, no Jaeger).
- No real-time streaming of audit events to the UI (polling is fine).
- No retention policies or audit log rotation in this change.
- No changes to how session archiving or Sati embeddings work.

---

## Decisions

### D1 — Single `audit_events` table, not separate per-type tables

**Decision:** One table `audit_events` with an `event_type` discriminator column, not `llm_calls`, `tool_calls`, etc.

**Rationale:** The session audit page needs to render a unified timeline ordered by `created_at`. A single table makes this query trivial (`SELECT * FROM audit_events WHERE session_id = ? ORDER BY created_at`). Separate tables would require UNION queries and complicate ordering. The `metadata` TEXT/JSON column absorbs type-specific fields.

**Alternative considered:** Typed tables per event category. Rejected — more migration burden, no meaningful query benefit at this scale.

---

### D2 — Subagents write LLM calls to `audit_events`, NOT to `messages`

**Decision:** Subagent LLM usage (Apoc, Neo, Trinity, Smith) goes into `audit_events` as `event_type = 'llm_call'` with `agent` tag, not into the `messages` table.

**Rationale:** The `messages` table is the LangChain chat history store — adding subagent messages there would pollute Oracle's context window on the next turn. Subagents already write tool messages into their own ephemeral history; we only need the aggregate usage per invocation, not every intermediate step.

**What does go into messages:** Only Oracle's messages (already the case). Oracle's tool call messages (already stored as `type = 'tool'`) gain an `agent = 'oracle'` column.

**Migration:** Add `agent TEXT DEFAULT 'oracle'` to `messages` via `migrateTable()`.

---

### D3 — Capture subagent usage via `execute()` return value enrichment

**Decision:** Apoc/Neo/Trinity/Smith `execute()` returns `{ output: string, usage?: AgentUsage }` instead of `string`. TaskWorker destructures this and writes usage to both `tasks` columns and an `audit_events` row.

```typescript
interface AgentUsage {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  stepCount: number;  // number of ReactAgent iterations
}

// execute() return type change:
type AgentResult = { output: string; usage?: AgentUsage };
```

**Rationale:** This is the least invasive change to the agent layer. Subagents already have access to their LLM response via the ReactAgent invocation result. We intercept `response.messages` to extract aggregate `usage_metadata` and measure wall-clock time.

**Alternative considered:** Each subagent writes directly to `audit_events` DB. Rejected — creates direct DB coupling in agent classes; the `execute()` return approach keeps agents testable and the DB write centralized in TaskWorker.

**Sync-mode caveat:** For sync-mode subagent calls (Oracle inline), Oracle itself wraps the call and records the `audit_events` row.

---

### D4 — DevKit tool instrumentation via wrapper, not modifying each tool

**Decision:** Add an `instrumentTool(tool, sessionId)` higher-order function in `src/devkit/index.ts`. It wraps any `StructuredTool`, records start time, calls the original `_call()`, and emits an `audit_events` row on completion.

```typescript
function instrumentTool(tool: StructuredTool, getSessionId: () => string | undefined): StructuredTool
```

`buildDevKit()` applies this wrapper to every tool it returns. The `sessionId` is resolved at invocation time (not at build time) via a getter, using the same `Apoc.currentSessionId` / `Neo.currentSessionId` static pattern already in place.

**Rationale:** DevKit has 7 tool modules with ~30 individual tools. Modifying each tool's `_call()` individually would be fragile and repetitive. A wrapper applied once in `buildDevKit()` is DRY and easier to test.

**MCP tools:** Same pattern applied in `Construtor.create()` — wrap each MCP tool before returning the array.

---

### D5 — Audit events API: session-scoped endpoint only

**Decision:** `GET /api/sessions/:id/audit` returns all `audit_events` for a session, ordered by `created_at`. No separate `/api/audit-events` resource.

**Rationale:** Audit events are always consumed in session context. A session-scoped endpoint is simpler and consistent with `GET /api/sessions/:id/messages`.

**Cost computation:** Done server-side. The endpoint JOINs `audit_events` with `model_pricing` and returns `estimated_cost_usd` per event and a session-level total.

---

### D6 — Chat UI: tool calls rendered as collapsible `<details>` blocks

**Decision:** Use a custom `ToolCallBlock` component with expand/collapse state. Not `<details>` HTML element (no animation support). Uses framer-motion `AnimatePresence` (already a dependency) for smooth expand/collapse.

**Message shape already has the data:** `messages.content` for `type = 'ai'` already contains `tool_calls: [{name, id, args}]`. The paired `type = 'tool'` message contains the result. The chat renderer groups them.

**Grouping strategy:** After fetching messages, the chat renderer groups consecutive `tool`-type messages under the preceding `ai` message that contains `tool_calls`. Each group renders as one collapsible block per tool call.

**Subagent block:** When an `ai` message calls `apoc_delegate` / `neo_delegate` / `trinity_delegate`, it renders as an `AgentBlock` with the agent name, the delegated task, and (from the paired `audit_events` data) the step count, duration, and token usage.

---

### D7 — Audit page layout: timeline + right-side cost panel

**Decision:** Two-column layout on `/sessions/:id/audit`:
- Left (70%): Chronological event timeline with icons per event type.
- Right (30%): Sticky cost summary panel (total, by agent, by model, by tool type).

**Data source:** Single `GET /api/sessions/:id/audit` call (SWR, 10s revalidation). No streaming.

**Cost breakdown:** Derived from audit events with `event_type = 'llm_call'`, joined with `model_pricing`. Tool events show count and total duration, not cost (tools don't consume tokens).

---

## Schema Changes

### `messages` table — new columns (Phase 1)
```sql
ALTER TABLE messages ADD COLUMN agent TEXT DEFAULT 'oracle';
-- values: 'oracle' | 'apoc' | 'neo' | 'trinity' | 'smith' | 'keymaker'
ALTER TABLE messages ADD COLUMN duration_ms INTEGER;
```

### `tasks` table — new columns (Phase 1)
```sql
ALTER TABLE tasks ADD COLUMN provider TEXT;
ALTER TABLE tasks ADD COLUMN model TEXT;
ALTER TABLE tasks ADD COLUMN input_tokens INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN output_tokens INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN duration_ms INTEGER;
ALTER TABLE tasks ADD COLUMN step_count INTEGER DEFAULT 0;
```

### `audit_events` table — new table (Phase 2)
```sql
CREATE TABLE IF NOT EXISTS audit_events (
  id           TEXT PRIMARY KEY,
  session_id   TEXT NOT NULL,
  task_id      TEXT,
  event_type   TEXT NOT NULL,
  -- 'llm_call' | 'tool_call' | 'task_created' | 'task_completed'
  -- | 'skill_executed' | 'chronos_job' | 'mcp_tool'
  agent        TEXT,
  -- 'oracle' | 'apoc' | 'neo' | 'trinity' | 'smith' | 'keymaker' | 'chronos'
  tool_name    TEXT,
  provider     TEXT,
  model        TEXT,
  input_tokens  INTEGER,
  output_tokens INTEGER,
  duration_ms   INTEGER,
  status       TEXT,  -- 'success' | 'error'
  metadata     TEXT,  -- JSON: args, result snippet, error message, etc.
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_events_session ON audit_events(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_events_task    ON audit_events(task_id);
```

---

## Migration Plan

All migrations use the existing `addColumn()` guard (`IF NOT EXISTS` via `table_info` pragma). Safe for existing installs — no data loss, no downtime.

**Order of operations:**
1. Phase 1: migrate `messages` + `tasks` in `migrateTable()` in `sqlite.ts` and `repository.ts`.
2. Phase 2: add `audit_events` table creation in `ensureTables()` of `TaskRepository` (shares the same DB).
3. Phases 3–4: frontend only, no DB changes.

**Rollback:** If the daemon is rolled back to a pre-change version, the new columns are ignored (SQLite ignores unknown columns in SELECT). The `audit_events` table is simply unused. No rollback DDL needed.

---

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| **Subagent usage extraction is LLM-provider-specific** — LangChain's `usage_metadata` shape varies. | Use same multi-fallback pattern already in Oracle (`usage_metadata ?? response_metadata?.usage ?? response_metadata?.tokenUsage`). Default to 0 if not found. |
| **Tool wrapper adds latency** — every tool invocation now does a DB INSERT. | Use synchronous `better-sqlite3` (already the project's SQLite driver) — INSERT is ~0.1ms, negligible vs tool execution. |
| **`audit_events` table grows unboundedly** | Acceptable for now; retention/pruning is a non-goal. Future change can add a TTL sweep. |
| **Phase 4 grouping logic is fragile** — tool messages must be matched to their parent AI message. | Use `tool_call_id` field (already present in ToolMessage) as the key for grouping. This is LangChain-stable. |
| **Sync-mode subagents bypass TaskWorker** — usage recording path is different. | Oracle wraps sync subagent calls with timing + audit event emission directly, mirroring TaskWorker's logic. |

---

## Open Questions

1. **Should `audit_events` be in its own DB file** (`audit.db`) or stay in `short-memory.db`? Keeping it in `short-memory.db` is simpler (same connection, same transaction scope) but increases that file's growth. → Defaulting to `short-memory.db` for now; can be split later.

2. **Keymaker skills** — `executeKeymakerTask()` wraps what exactly? Does it invoke an LLM or just execute a JS function? Need to verify whether a `skill_executed` event needs `provider/model/tokens` or just `tool_name/duration`. → Review `src/runtime/keymaker.ts` during implementation.

3. **Smith remote execution** — token usage from the remote Smith process: does the WebSocket response include usage metadata? If not, `input_tokens`/`output_tokens` will be 0 for Smith tasks. → Acceptable for Phase 1; can be enriched when Smith protocol is extended.
