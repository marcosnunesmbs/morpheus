---

# Data Model: Chronos — Temporal Intent Engine

**Feature**: 024-temporal-scheduler
**Date**: 2026-02-21
**Storage**: `~/.morpheus/memory/short-memory.db` (existing better-sqlite3 database)

---

## Entities

### 1. ChronosJob

Represents a user's temporal intention — a prompt to be executed at a specific time or on a recurring schedule.

**Table**: `chronos_jobs`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID (crypto.randomUUID()) |
| `prompt` | TEXT | NOT NULL | The prompt text to send to the Oracle when triggered |
| `schedule_type` | TEXT | NOT NULL | `once` \| `cron` \| `interval` |
| `schedule_expression` | TEXT | NOT NULL | Original user input (natural language, cron string, or ISO datetime) |
| `cron_normalized` | TEXT | NULL | Normalized cron expression computed from `schedule_expression` (used for `cron` and `interval` types to compute `next_run_at`) |
| `timezone` | TEXT | NOT NULL, DEFAULT 'UTC' | IANA timezone string (e.g., `America/Sao_Paulo`) |
| `next_run_at` | INTEGER | NULL | Unix timestamp (ms) of next scheduled execution. NULL when disabled or completed |
| `last_run_at` | INTEGER | NULL | Unix timestamp (ms) of last execution attempt |
| `enabled` | INTEGER | NOT NULL, DEFAULT 1 | 0 = disabled, 1 = enabled (SQLite boolean) |
| `created_at` | INTEGER | NOT NULL | Unix timestamp (ms) of creation |
| `updated_at` | INTEGER | NOT NULL | Unix timestamp (ms) of last update |
| `created_by` | TEXT | NOT NULL | Origin channel: `ui` \| `telegram` \| `api` |

**Indexes**:
- `idx_chronos_jobs_next_run`: `(enabled, next_run_at)` — used by the worker's query for due jobs
- `idx_chronos_jobs_created_by`: `(created_by)` — used for list filtering

**State Transitions**:
```
[created, enabled=1] → next_run_at set
       ↓ (time reaches next_run_at)
[executing] → worker marks last_run_at, recomputes next_run_at (recurring) or sets enabled=0 (once)
       ↓
[enabled=1, next_run_at updated] (recurring) | [enabled=0, next_run_at=NULL] (once)

[any state] → user sets enabled=0 → [disabled, next_run_at=NULL]
[disabled]  → user sets enabled=1 → next_run_at recomputed from now
```

**Validation Rules**:
- `schedule_type` must be one of: `once`, `cron`, `interval`
- `schedule_expression` must be non-empty
- `timezone` must be a valid IANA timezone string
- `next_run_at` must be in the future at creation time (for `once` type)
- For `cron` type: `schedule_expression` must be a valid 5-field cron expression
- For `interval` type: resolved interval must be ≥ 60,000 ms (60 seconds)
- For `once` type: resolved datetime must be in the future

---

### 2. ChronosExecution

A history entry recording each time a ChronosJob was triggered and the outcome.

**Table**: `chronos_executions`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID (crypto.randomUUID()) |
| `job_id` | TEXT | NOT NULL, FK → chronos_jobs.id | Parent job reference |
| `triggered_at` | INTEGER | NOT NULL | Unix timestamp (ms) when the worker fired this job |
| `completed_at` | INTEGER | NULL | Unix timestamp (ms) when Oracle returned a result |
| `status` | TEXT | NOT NULL | `running` \| `success` \| `failed` \| `timeout` |
| `error` | TEXT | NULL | Error message if status is `failed` or `timeout` |
| `session_id` | TEXT | NOT NULL | Oracle session used: `chronos-job-<jobId>` |

**Indexes**:
- `idx_chronos_executions_job_id`: `(job_id, triggered_at DESC)` — used for execution history queries

**Retention**: Last 100 executions per job are retained. Older records are pruned automatically by the ChronosWorker after each execution cycle.

---

### 3. ChronosConfig (in-memory / config.yaml)

User-level preferences stored in `~/.morpheus/config.yaml` under the `chronos` key.

```yaml
chronos:
  timezone: "America/Sao_Paulo"   # Default IANA timezone for new jobs
  check_interval_ms: 60000        # How often ChronosWorker polls for due jobs (min: 60000)
  max_active_jobs: 100            # Maximum simultaneous enabled jobs
```

**Zod Schema** (to be added to `src/config/schema.ts`):
```typescript
const ChronosConfigSchema = z.object({
  timezone: z.string().default('UTC'),
  check_interval_ms: z.number().min(60000).default(60000),
  max_active_jobs: z.number().min(1).max(1000).default(100),
});
```

**Environment Variable Overrides**:
- `MORPHEUS_CHRONOS_TIMEZONE`
- `MORPHEUS_CHRONOS_CHECK_INTERVAL_MS`
- `MORPHEUS_CHRONOS_MAX_ACTIVE_JOBS`

---

## Relationships

```
ChronosConfig (1) ──── defines defaults for ────► ChronosJob (N)
ChronosJob    (1) ──── has many ─────────────────► ChronosExecution (N)
ChronosWorker       ──── reads ──────────────────► ChronosJob (next_run_at <= now, enabled=1)
ChronosWorker       ──── writes ─────────────────► ChronosExecution (on each trigger)
Oracle              ──── invoked by ─────────────► ChronosWorker (via oracle.chat)
```

---

## Schema Migration Strategy

Following the existing `migrateTable()` pattern in `src/runtime/memory/sqlite.ts`:

1. `ChronosRepository.constructor()` calls `ensureTable()` which runs `CREATE TABLE IF NOT EXISTS`
2. `migrateTable()` is called immediately after, checking for any missing columns via `PRAGMA table_info`
3. Missing columns are added one by one with `ALTER TABLE ... ADD COLUMN`
4. This makes the schema evolution safe for existing installations

**Initial DDL**:
```sql
CREATE TABLE IF NOT EXISTS chronos_jobs (
  id TEXT PRIMARY KEY,
  prompt TEXT NOT NULL,
  schedule_type TEXT NOT NULL,
  schedule_expression TEXT NOT NULL,
  cron_normalized TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  next_run_at INTEGER,
  last_run_at INTEGER,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  created_by TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chronos_jobs_next_run
  ON chronos_jobs (enabled, next_run_at);

CREATE INDEX IF NOT EXISTS idx_chronos_jobs_created_by
  ON chronos_jobs (created_by);

CREATE TABLE IF NOT EXISTS chronos_executions (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES chronos_jobs(id) ON DELETE CASCADE,
  triggered_at INTEGER NOT NULL,
  completed_at INTEGER,
  status TEXT NOT NULL,
  error TEXT,
  session_id TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chronos_executions_job
  ON chronos_executions (job_id, triggered_at DESC);
```
