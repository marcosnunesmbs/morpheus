---

# Research: Chronos — Temporal Intent Engine

**Feature**: 024-temporal-scheduler
**Date**: 2026-02-21
**Status**: Complete — all unknowns resolved

---

## Decision 1: Cron/Schedule Execution Library

**Decision**: Use `node-cron` v3 for triggering recurring jobs + `cron-parser` v4 for computing `next_run_at` timestamps without scheduling.

**Rationale**:
- `node-cron` is the de-facto standard for cron scheduling in Node.js (3M+ weekly downloads). It accepts standard 5-field cron expressions, is actively maintained, and integrates cleanly with TypeScript.
- `cron-parser` is the companion library for computing next/previous occurrence dates from a cron expression without actually running a job — essential for persisting `next_run_at` to the database before the job fires.
- Together they cover the full lifecycle: parse → compute next run → persist → fire → recompute.

**Alternatives Considered**:
- `node-schedule`: More flexible but heavier, uses a different expression format, and does not separate expression parsing from execution as cleanly.
- `agenda` / `bull`: Full-featured job queue systems. Overengineered for Morpheus' local single-user deployment; introduce Redis or MongoDB dependencies that conflict with the local-first principle.
- Pure `setInterval`: No cron expression support; requires manual interval tracking with no natural language bridge.

---

## Decision 2: Natural Language Date Parsing

**Decision**: Use `chrono-node` v2 for parsing natural language time expressions (e.g., "tomorrow at 9am", "next Monday at 8pm", "in 2 hours").

**Rationale**:
- `chrono-node` is the standard NLP date parser for Node.js, supports English and Portuguese (`pt` locale), and returns typed `ParsedResult` objects with explicit date components. This is critical for resolving expressions like "amanhã às 9h" correctly in the user's timezone.
- It supports both absolute ("2026-03-01 at 14:00") and relative ("in 30 minutes", "next Friday") expressions, which covers all Chronos `once` and `interval` input cases.
- It does not modify the cron expression path — cron inputs are passed directly to `cron-parser`.

**Alternatives Considered**:
- `date-fns` alone: No NLP support; requires structured input.
- `sugar-date`: Less TypeScript-friendly and heavier bundle.
- LLM-based parsing: Viable but adds latency, cost, and a network dependency for a simple datetime extraction task. Reserved as fallback if `chrono-node` fails to parse.

---

## Decision 3: Human-Readable Cron Interpretation

**Decision**: Use `cronstrue` v1 to convert cron expressions to human-readable strings for display in the UI and Telegram confirmations (e.g., `0 9 * * 1-5` → "At 09:00 AM, Monday through Friday").

**Rationale**:
- Zero-dependency, small footprint (~5 KB), TypeScript-native, and supports locale-aware output. Directly reduces friction for users who write raw cron expressions and need to verify their intent before saving.
- Used purely for display; never involved in execution logic.

**Alternatives Considered**:
- LLM interpretation: Too slow and costly for a synchronous preview.
- Manual description: Not maintainable across all valid cron variations.

---

## Decision 4: Timezone Handling

**Decision**: Use the built-in `Intl.DateTimeFormat` API (Node.js 18+ built-in) combined with `date-fns-tz` v3 for timezone-aware date arithmetic and formatting.

**Rationale**:
- `Intl.DateTimeFormat` (IANA timezone database, built into Node.js 18+) handles timezone offset resolution without any additional package. Morpheus already requires Node.js ≥ 18.
- `date-fns-tz` provides `toZonedTime()` and `fromZonedTime()` helpers that make it straightforward to compute "9am in America/Sao_Paulo" as a UTC timestamp. It is composable with `cron-parser`'s `options.currentDate` to compute the correct next occurrence in the user's timezone.
- Both `chrono-node` and `cron-parser` accept a reference date/timezone, so `date-fns-tz` acts as the glue layer between them and the stored UTC timestamps.

**Alternatives Considered**:
- `moment-timezone`: Deprecated; the Moment team recommends migration away from it.
- `luxon`: Excellent but heavier than `date-fns-tz`; no additional benefit over `date-fns-tz` for this use case.
- Manual UTC offset math: Error-prone for DST transitions.

---

## Decision 5: Storage Strategy

**Decision**: Add two new tables (`chronos_jobs`, `chronos_executions`) to the existing `short-memory.db` (better-sqlite3). Do NOT create a separate database file.

**Rationale**:
- Keeps Morpheus local-first with a single data store. Adding a second SQLite file for Chronos would introduce operational complexity (backup, migration, startup ordering) for no benefit at the current scale.
- `better-sqlite3` is already a dependency, is synchronous (no callback hell), and Morpheus already uses the established `migrateTable()` pattern for safe schema evolution.
- The existing `TaskRepository` pattern provides a proven blueprint: singleton class, `ensureTable()` called in constructor, `migrateTable()` for column additions.

**Alternatives Considered**:
- Separate `chronos.db` file: Useful if isolation between subsystems were required, but adds complexity. Can be refactored later if needed.
- Reuse `tasks` table with a new `agent = 'chronos'`: Would couple Chronos semantics to the task system, making execution history, recurring recalculation, and cron expression storage awkward.
- In-memory storage: Non-starter; violates the "must survive restarts" requirement.

---

## Decision 6: Chronos Worker Architecture

**Decision**: Implement `ChronosWorker` as a standalone polling singleton (not an extension of `TaskWorker`) following the `session-embedding-scheduler.ts` pattern — a `setInterval` with an `isRunning` guard.

**Rationale**:
- `TaskWorker` is designed for claim-and-execute on a per-task basis with retry logic and worker IDs. Chronos needs a fundamentally different loop: query all due jobs, trigger each via Oracle (not via the task queue), then recompute `next_run_at`. These semantics don't compose cleanly with `TaskWorker`.
- The simpler `session-embedding-scheduler.ts` pattern (a standalone `setInterval` + guard) is sufficient: Chronos polls every 60 seconds (configurable), marks jobs as running, invokes Oracle with the stored prompt, updates execution metadata, and updates `next_run_at` for recurring jobs.
- Oracle is already available as a singleton (`Oracle.getInstance()`), which matches how Apoc and Trinity are accessed from TaskWorker.

**Alternatives Considered**:
- Extend TaskWorker with a new agent type `'chronos'`: Couples unrelated concerns; the task retry system is inappropriate for scheduled jobs.
- Use a dedicated cron library to fire jobs (e.g., `node-cron` scheduling per job): Requires maintaining in-memory job registry that must survive restarts — the SQLite poll-based approach is simpler and more resilient.

---

## Decision 7: Oracle Invocation Pattern for Chronos

**Decision**: Chronos invokes the Oracle directly via `oracle.chat(prompt, sessionId)` using a dedicated internal session (e.g., `chronos-job-<jobId>`). Results are stored in `chronos_executions` and optionally forwarded via the TaskNotifier pattern.

**Rationale**:
- This matches how the Telegram adapter invokes Oracle for user commands — it's already the battle-tested path.
- Using a dedicated session per job isolates Chronos job execution from the user's chat history while still allowing execution context to be reviewed in the Sessions page.
- Notification delivery (if needed) can reuse the existing TaskNotifier and notification channel infrastructure.

**Alternatives Considered**:
- Enqueue into TaskRepository as a regular task: Adds the task lifecycle overhead but loses the direct prompt-to-Oracle path. Could be revisited if complex retry semantics are needed.

---

## Decision 8: Maximum Concurrent Active Jobs Limit

**Decision**: Default maximum of **100 active jobs** per system (single-user deployment).

**Rationale**:
- Provides an effective guard against accidental runaway schedule creation without being restrictive for normal use. A power user running a full automation suite would rarely need more than 50 simultaneous recurring jobs.
- Configurable via `chronos.max_active_jobs` in config for advanced users.

---

## Packages to Add

```json
"node-cron": "^3.0.3",
"cron-parser": "^4.9.0",
"cronstrue": "^2.50.0",
"chrono-node": "^2.7.7",
"date-fns-tz": "^3.2.0"
```

Note: `date-fns` (without `-tz`) is already installed (`date-fns` v4 is used internally). `date-fns-tz` v3 is compatible with `date-fns` v3/v4 and does not introduce a version conflict.
