# Tasks: Chronos — Temporal Intent Engine

**Input**: Design documents from `specs/024-temporal-scheduler/`
**Branch**: `024-temporal-scheduler`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Exact file paths are included in every task description

---

## Phase 1: Setup

**Purpose**: Install new dependencies and create directory structure

- [X] T001 Install packages node-cron@3, cron-parser@4, cronstrue@2, chrono-node@2, date-fns-tz@3 via npm install in package.json
- [X] T002 Create directories src/runtime/chronos/, src/http/routers/, src/ui/src/components/chronos/, src/ui/src/services/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before any user story can begin

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Add ChronosConfig interface and ChronosConfigSchema (zod) to src/config/schema.ts with fields: timezone (string, default 'UTC'), check_interval_ms (number, min 60000, default 60000), max_active_jobs (number, min 1, max 1000, default 100)
- [X] T004 Add getChronosConfig() method to src/config/manager.ts returning ChronosConfig with defaults, and add MORPHEUS_CHRONOS_TIMEZONE, MORPHEUS_CHRONOS_CHECK_INTERVAL_MS, MORPHEUS_CHRONOS_MAX_ACTIVE_JOBS env var overrides in applyEnvironmentVariablePrecedence()
- [X] T005 Create ChronosRepository singleton in src/runtime/chronos/repository.ts: ensureTable() creates chronos_jobs and chronos_executions tables with all columns and indexes per data-model.md DDL; migrateTable() checks PRAGMA table_info for missing columns; CRUD methods: createJob(), getJob(id), listJobs(filters), updateJob(id, patch), deleteJob(id), getDueJobs(nowMs), enableJob(id), disableJob(id), insertExecution(record), completeExecution(id, status, error?), listExecutions(jobId, limit), pruneExecutions(jobId, keepCount)
- [X] T006 Create parseScheduleExpression(expression, type, opts) in src/runtime/chronos/parser.ts: for 'once' use chrono-node with timezone-aware reference date; for 'cron' use cron-parser to validate and compute next occurrence, cronstrue for human_readable; for 'interval' convert phrase to cron via intervalToCron() helper then delegate to cron path; return ParsedSchedule { type, next_run_at, cron_normalized, human_readable }; throw descriptive errors for invalid inputs (invalid cron, past datetime, interval < 60s)
- [X] T036 *(moved from Polish — I2)* Add max_active_jobs count check to createJob() in src/runtime/chronos/repository.ts: before INSERT, query `SELECT COUNT(*) FROM chronos_jobs WHERE enabled = 1`; if count >= config.max_active_jobs throw a ChronosError with message `Maximum active jobs limit (${limit}) reached. Disable or delete an existing job first.`; this enforces FR-009 as a hard gate at every create path (API, Telegram, future channels)
- [X] T041 [P] Write unit tests for parseScheduleExpression() in src/runtime/chronos/parser.test.ts: once-type with valid ISO datetime → correct next_run_at; once-type with past datetime → throws; once-type with natural language "tomorrow at 9am" → resolves in given timezone; cron-type with valid 5-field expression → next_run_at > now, cron_normalized = input, human_readable non-empty; cron-type with invalid expression → throws; interval-type "every 30 minutes" → interval 1800000ms >= 60000ms, valid cron_normalized; interval-type "every 30 seconds" → throws (< 60s minimum) *(C1 — constitution unit test gate)*

**Checkpoint**: Config, repository, parser, max_active_jobs enforcement, and parser unit tests are ready — all user story phases can now begin

---

## Phase 3: User Story 1 — Create a One-Time Scheduled Prompt (Priority: P1) 🎯 MVP

**Goal**: Users can create a one-time Chronos job via the API and web UI; the ChronosWorker triggers it automatically at the scheduled time and auto-disables the job.

**Independent Test**: Create a job with "in 2 minutes" expression via the UI → wait 2 minutes → verify `last_run_at` is set, `enabled` is false, and execution history has a `success` record. (See quickstart.md Scenario 1)

### Implementation

- [X] T007 [US1] Create ChronosWorker class in src/runtime/chronos/worker.ts: constructor receives ChronosRepository + Oracle instances; start() sets setInterval(tick, pollIntervalMs) where pollIntervalMs comes from configManager.getChronosConfig(); stop() clears interval; tick() has isRunning guard, calls repo.getDueJobs(Date.now()), fires executeJob() for each; executeJob() inserts execution record as 'running', calls oracle.chat(job.prompt, `chronos-job-${job.id}`), updates execution to 'success'/'failed'; for once-type calls repo.disableJob(); for recurring calls parseScheduleExpression to recompute next_run_at then repo.updateJob(); finally calls repo.pruneExecutions(jobId, 100)
- [X] T042 [P] [US1] Write unit tests for ChronosWorker.tick() in src/runtime/chronos/worker.test.ts: mock ChronosRepository and Oracle; test isRunning guard prevents concurrent tick execution; test getDueJobs() called with current timestamp; test once-type job triggers oracle.chat() then repo.disableJob(); test recurring job triggers oracle.chat() then repo.updateJob() with new next_run_at; test oracle.chat() rejection sets execution status to 'failed' and job remains enabled *(C1 — constitution unit test gate)*
- [X] T008 [US1] Create src/http/routers/chronos.ts with two exported router factories: (1) createChronosJobRouter(repo, worker) — handles all /api/chronos job endpoints: POST validates body (prompt, schedule_type='once', schedule_expression, timezone?) via zod, calls parseScheduleExpression, calls repo.createJob() (T036 guard throws if limit reached), returns CreateChronosJobResponse; GET /api/chronos with ?enabled and ?created_by filters; GET /api/chronos/:id or 404; DELETE /api/chronos/:id; PATCH /api/chronos/:id/enable and /disable; GET /api/chronos/:id/executions (moved here from US3 for router cohesion); (2) createChronosConfigRouter(worker) — handles GET and POST /api/config/chronos *(see I4 fix)*
- [X] T009 [US1] Mount both chronos routers in src/http/api.ts: import { createChronosJobRouter, createChronosConfigRouter } from './routers/chronos.js'; add router.use('/chronos', createChronosJobRouter(chronosRepo, chronosWorker)) and router.use('/config/chronos', createChronosConfigRouter(chronosWorker)) inside createApiRouter(); pass chronosWorker instance into createApiRouter() signature *(I4 fix — separate mount points)*
- [X] T010 [US1] Wire ChronosWorker into src/cli/commands/start.ts: import ChronosWorker; instantiate after Oracle init; call chronosWorker.start() alongside taskWorker.start(); call chronosWorker.stop() in the shutdown handler
- [X] T038 [US1] Add POST /api/chronos/preview endpoint inside createChronosJobRouter() in src/http/routers/chronos.ts: accepts { expression, schedule_type, timezone? } body; calls parseScheduleExpression() without persisting; computes next_occurrences (next 3 runs) for recurring types; returns { next_run_at, human_readable, next_occurrences: string[] }; returns 400 with descriptive error for invalid expressions; this endpoint is required by ChronosPreview (T012) for live feedback — must exist before frontend components are built *(moved from Polish — I1 fix)*
- [X] T011 [P] [US1] Create src/ui/src/services/chronos.ts: export useSWR-based hooks useChronosJobs(filters?), useChronosJob(id), useChronosExecutions(id); export async functions createChronosJob(req), updateChronosJob(id, req), deleteChronosJob(id), enableChronosJob(id), disableChronosJob(id), getChronosConfig(), updateChronosConfig(req); all functions call fetch('/api/chronos/...') with appropriate methods and JSON bodies
- [X] T012 [P] [US1] Create ChronosPreview component in src/ui/src/components/chronos/ChronosPreview.tsx: receives scheduleExpression + scheduleType + timezone props; calls POST /api/chronos/preview (or compute client-side via service); renders "Next run:" datetime in human-readable format and the cronstrue interpretation; shows error message if expression is invalid; debounced on input change
- [X] T013 [P] [US1] Create CreateChronosModal component in src/ui/src/components/chronos/CreateChronosModal.tsx: modal with TextInput for prompt, SelectInput for schedule_type (once only for now), TextInput for schedule_expression with placeholder "tomorrow at 9am" or ISO datetime, SelectInput for timezone (IANA list, defaults to global chronos config timezone); embeds ChronosPreview below expression input; Save calls createChronosJob() service, shows success toast, calls onCreated callback; follows dark mode modal pattern from CLAUDE.md
- [X] T014 [P] [US1] Create ChronosTable component in src/ui/src/components/chronos/ChronosTable.tsx: renders job list with columns: Prompt (truncated), Schedule, Next Run, Last Run, Status badge (Enabled/Disabled), Source; row actions: Enable/Disable toggle, Delete (with confirmation); uses useChronosJobs() SWR hook for data; empty state message; loading skeleton
- [X] T015 [US1] Create Chronos page in src/ui/src/pages/Chronos.tsx: page header "Chronos"; "New Job" button opens CreateChronosModal; renders ChronosTable; handles modal open/close state; mutates SWR cache on job creation
- [X] T016 [US1] Add Route path="/chronos" element={<Chronos />} to the protected routes block in src/ui/src/App.tsx; add import for Chronos page
- [X] T017 [US1] Add Chronos navigation entry to the sidebar/nav component (find the file containing the nav links list — likely src/ui/src/components/Layout.tsx or similar); use a clock or calendar icon; label "Chronos"

**Checkpoint**: US1 complete — one-time jobs can be created via UI and auto-execute. Test independently via quickstart.md Scenario 1.

---

## Phase 4: User Story 2 — Create and Manage Recurring Chronos Jobs (Priority: P2)

**Goal**: Users can create cron and interval-based recurring jobs; the worker recalculates next_run_at after each execution and keeps the job active indefinitely.

**Independent Test**: Create a recurring job with `*/2 * * * *` → wait 4 minutes → verify 2 execution records exist, job remains enabled, next_run_at advances. (See quickstart.md Scenario 2)

### Implementation

- [X] T018 [US2] Extend ChronosWorker.executeJob() in src/runtime/chronos/worker.ts to handle recurring jobs: after successful execution, call parseScheduleExpression(job.cron_normalized, job.schedule_type, {timezone}) to get new next_run_at, then call repo.updateJob(job.id, { next_run_at: next.next_run_at, last_run_at: now }); ensure once-type path remains unchanged (auto-disable)
- [X] T019 [US2] Add cron and interval POST validation to src/http/routers/chronos.ts: extend the POST /api/chronos zod schema to accept schedule_type 'cron' | 'interval'; validate via parseScheduleExpression before saving; add minimum interval enforcement (throw 400 if interval < 60s); add PUT /api/chronos/:id endpoint that accepts { prompt?, schedule_expression?, timezone?, enabled? }, recomputes next_run_at if expression changed, calls repo.updateJob()
- [X] T020 [P] [US2] Extend CreateChronosModal in src/ui/src/components/chronos/CreateChronosModal.tsx to support recurring type: when schedule_type switches to 'cron' or 'interval', show tabbed input (Natural Language | Cron Expression with a compact cron syntax hint); schedule_type selector now includes Once / Recurring (Cron) / Recurring (Interval)
- [X] T021 [P] [US2] Extend ChronosPreview in src/ui/src/components/chronos/ChronosPreview.tsx to display cronstrue human-readable string for cron type (e.g. "Every day at 09:00 AM") and interval description for interval type; show the next 3 upcoming execution times for recurring jobs

**Checkpoint**: US2 complete — recurring jobs work end-to-end. Can be tested independently via quickstart.md Scenario 2.

---

## Phase 5: User Story 3 — Manage Chronos Jobs via the Web Dashboard (Priority: P3)

**Goal**: Full CRUD management from the dashboard including execution history panel, edit modal, and all table row actions.

**Independent Test**: Navigate to Chronos page → create a job → disable it → view history → edit prompt → re-enable → verify all state transitions reflected in real time. (See quickstart.md Scenarios 3–4)

### Implementation

- [X] T022 [US3] Add execution history SWR hook useChronosExecutions(jobId) and the getChronosExecutions(id, limit?) fetch function to src/ui/src/services/chronos.ts (the GET /api/chronos/:id/executions endpoint was moved into T008 to keep router cohesion)
- [X] T023 [P] [US3] Create ExecutionHistory component in src/ui/src/components/chronos/ExecutionHistory.tsx: receives jobId prop; uses useChronosExecutions(jobId) SWR hook; renders table with columns: Triggered At, Completed At, Status badge (success/failed/timeout/running), Error (truncated); empty state "No executions yet"; follows content box dark mode pattern (dark:bg-zinc-900)
- [X] T024 [US3] Add execution history panel to Chronos page in src/ui/src/pages/Chronos.tsx: clicking "View history" row action in ChronosTable sets selectedJobId state; renders ExecutionHistory in a slide-over panel or expandable row below the selected job; close button clears selection
- [X] T025 [US3] Add edit job functionality: extend ChronosTable in src/ui/src/components/chronos/ChronosTable.tsx to add "Edit" row action; pass isEdit=true + initialValues to CreateChronosModal; in CreateChronosModal handle edit mode — pre-fill form fields, call updateChronosJob(id, req) on save instead of createChronosJob(); show success toast on update

**Checkpoint**: US3 complete — full dashboard management works. Test independently via quickstart.md Scenario 3.

---

## Phase 6: User Story 4 — Manage Chronos Jobs via Telegram (Priority: P4)

**Goal**: All six Chronos commands work via Telegram with the two-message confirmation flow for job creation.

**Independent Test**: Send `/chronos "check disk space in 3 minutes"` → confirm → verify job created; send `/chronos_list` → verify job appears; send `/chronos_delete <id>` → verify removed. (See quickstart.md Scenario 4)

### Implementation

- [X] T026 [US4] Add /chronos create command handler in src/channels/telegram.ts: in handleSystemCommand() add case '/chronos'; use chrono-node's `chrono.parse(fullText)` to extract all datetime results from the entire message — the first matched datetime fragment is the time expression, and everything else is the prompt (strip the matched fragment from the message to get the prompt text); if chrono-node finds no datetime, reply with "Could not detect a time expression. Try: `/chronos Check disk space tomorrow at 9am`"; if datetime found, call parseScheduleExpression(extractedTimeText, inferredType, {timezone: globalConfig.timezone}) to compute next_run_at and human_readable; reply with confirmation: "📅 *[prompt]* — [human_readable] ([formatted datetime]). Confirm? Reply `yes` or `no`"; store pending state in a `Map<userId, PendingChronosCreate & {expiresAt: number}>` — each entry includes the parsed job data and an expiry timestamp (Date.now() + 5 * 60 * 1000); add a `setTimeout(() => pendingMap.delete(userId), 300_000)` per entry to auto-expire; in the regular text message handler, check if user has a pending entry and if `Date.now() < entry.expiresAt`; on 'yes' persist via repo.createJob(); on 'no' or expired reply "Cancelled." and delete entry *(U1 fix — explicit chrono-node intent extraction strategy)*
- [X] T027 [P] [US4] Add /chronos_list handler in src/channels/telegram.ts: query repo.listJobs({ enabled: true }); format as numbered list with ID (first 8 chars), prompt summary (30 chars truncated), and next_run_at in human-readable format; reply "No active Chronos jobs." if empty
- [X] T028 [P] [US4] Add /chronos_view handler in src/channels/telegram.ts: extract id arg from command; call repo.getJob(id); format full job details (prompt, schedule, timezone, next/last run, status); include last 3 executions from repo.listExecutions(id, 3)
- [X] T029 [P] [US4] Add /chronos_disable and /chronos_enable handlers in src/channels/telegram.ts: extract id arg; call repo.disableJob(id) or enableJob(id); reply with confirmation and new status; return 404-style message if job not found
- [X] T030 [P] [US4] Add /chronos_delete handler in src/channels/telegram.ts: extract id arg; call repo.deleteJob(id); reply "Job <id> deleted." or "Job not found." if missing
- [X] T031 [US4] Register all new command cases in the switch statement of handleSystemCommand() in src/channels/telegram.ts: /chronos_list, /chronos_view, /chronos_disable, /chronos_enable, /chronos_delete; update the HELP_MESSAGE constant to list all six Chronos commands with brief descriptions

**Checkpoint**: US4 complete — Telegram management parity with dashboard. Test via quickstart.md Scenario 4.

---

## Phase 7: User Story 5 — Configure Global Chronos Preferences in Zaion (Priority: P5)

**Goal**: Users can set default timezone and check interval in Zaion; settings apply immediately to new job creation and the worker loop.

**Independent Test**: Set timezone to America/Sao_Paulo in Zaion → create job "tomorrow at 9am" → verify stored timezone is America/Sao_Paulo and next_run_at is correct local time. (See quickstart.md Scenario 5)

### Implementation

- [X] T032 [US5] Add GET /api/config/chronos and POST /api/config/chronos to src/http/routers/chronos.ts: GET returns configManager.getChronosConfig(); POST validates body with ChronosConfigSchema, calls configManager.save() with updated chronos key, calls chronosWorker.updateInterval(newConfig.check_interval_ms) to hot-reload without restart; returns updated ChronosConfig
- [X] T033 [US5] Add updateInterval(newMs) method to ChronosWorker in src/runtime/chronos/worker.ts: clears existing setInterval and sets a new one with the updated interval; validates newMs >= 60000 before applying
- [X] T034 [US5] Create ChronosSettings component in src/ui/src/pages/Settings.tsx (or a dedicated src/ui/src/components/chronos/ChronosSettings.tsx): timezone SelectInput with searchable IANA timezone list; check_interval NumberInput (in seconds, converts to ms on save, min 60); uses useChronosConfig() SWR hook; Save calls updateChronosConfig(); shows success/error feedback; follows form label and input dark mode patterns from CLAUDE.md
- [X] T035 [US5] Add Chronos tab to the Zaion settings page (src/ui/src/pages/Settings.tsx or wherever the Agents sub-tabs are defined): add "Chronos" tab that renders ChronosSettings; ensure tab is visible alongside Oracle/Sati/Neo/Apoc/Trinity tabs

**Checkpoint**: US5 complete — global settings apply to all subsequent job creation. Test via quickstart.md Scenario 5.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Observability and end-to-end completeness across all stories

*(T036 moved to Phase 2 — I2 fix; T038 moved to Phase 3/US1 — I1 fix)*

- [X] T037 [P] Add [Chronos] display logging throughout src/runtime/chronos/worker.ts: log worker start/stop with interval, each job trigger ("Job <id> triggered"), each completion with status and next_run_at, each error; use the existing display/logger pattern (DisplayManager or winston) consistent with other workers
- [ ] T039 Validate quickstart.md Scenarios 1–7 end-to-end: run each scenario manually or via automation, confirm all acceptance criteria from spec.md are met, fix any discovered issues
- [X] T040 [P] Update MEMORY.md at C:/Users/marco/.claude/projects/E--morpheus/memory/MEMORY.md to document Chronos architecture: ChronosWorker, ChronosRepository, new API routes, Telegram commands, and Zaion settings tab

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (packages installed) — **BLOCKS all user story phases**
- **US1 (Phase 3)**: Depends on Phase 2 — independent of US2–US5
- **US2 (Phase 4)**: Depends on Phase 2 — independent of US3–US5 (extends US1 worker/router but does not block it)
- **US3 (Phase 5)**: Depends on Phase 2 + US1 (execution endpoint + edit modal build on US1 API/components)
- **US4 (Phase 6)**: Depends on Phase 2 — independent of US1–US3 (Telegram uses repo directly)
- **US5 (Phase 7)**: Depends on Phase 2 — independent of US1–US4 (config/Zaion path is standalone)
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — no dependency on other stories
- **US2 (P2)**: Can start after Phase 2 — extends US1 files but adds new capabilities; do not conflict if worked in sequence
- **US3 (P3)**: Can start after Phase 2 — best started after US1 (reuses CreateChronosModal and the /api/chronos router)
- **US4 (P4)**: Can start after Phase 2 — fully independent (different file: telegram.ts)
- **US5 (P5)**: Can start after Phase 2 — fully independent (different files: settings UI + config API)

### Within Each User Story

- Repository/parser (Phase 2) before worker (US1)
- T036 (max_active_jobs) before T008 (POST /api/chronos calls createJob with guard)
- T041 (parser unit tests) in parallel with T007 after T006
- Worker (T007) before worker unit tests (T042) and before API router (T008)
- T038 (preview endpoint) is part of T008's router file — must be implemented in T008
- API router (T008 + T009) before frontend service (T011)
- Frontend service before UI components (T011 → T012/T013/T014)
- Components before page assembly (T015 → T016 → T017)

---

## Parallel Opportunities

### Phase 2 — Foundational (run in sequence: T003 → T004 → T005 → T006, then parallel T036/T041)
```
T036  max_active_jobs enforcement in repository.ts  [P after T005]
T041  Unit tests for parseScheduleExpression        [P after T006]
```

### Phase 3 — US1 (T007 → T042 [P], then T008 → T038 → T009 → T010, then parallel frontend)
```
T042  Unit tests for ChronosWorker.tick()   [P after T007]
T038  POST /api/chronos/preview endpoint    [in T008 router, before T012]
```
Then parallel (after T007–T010 and T038 complete):
```
T011  Create src/ui/src/services/chronos.ts
T012  Create ChronosPreview component
T013  Create CreateChronosModal component
T014  Create ChronosTable component
```
Then sequentially: T015 → T016 → T017

### Phase 4 — US2 (T020 and T021 are parallel)
```
T020  Extend CreateChronosModal for recurring type
T021  Extend ChronosPreview for cron interpretation
```

### Phase 5 — US3 (T022 and T023 are parallel)
```
T022  Add GET /api/chronos/:id/executions endpoint
T023  Create ExecutionHistory component
```

### Phase 6 — US4 (T027–T030 are parallel after T026)
```
T027  /chronos_list handler
T028  /chronos_view handler
T029  /chronos_disable and /chronos_enable handlers
T030  /chronos_delete handler
```

### Cross-story parallel (after Phase 2)
```
Developer A: US1 (T007–T017)
Developer B: US4 (T026–T031)  — fully independent, uses only telegram.ts
Developer C: US5 (T032–T035)  — fully independent, uses only config + settings UI
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: Foundational — T003 → T004 → T005 → T006
3. Complete Phase 3: US1 — T007 → T008 → T009 → T010, then parallel T011/T012/T013/T014, then T015 → T016 → T017
4. **STOP and VALIDATE**: Run quickstart.md Scenario 1 — one-time job created via UI, executes at scheduled time
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Core infrastructure ready
2. US1 → One-time jobs via API + UI (**MVP**, standalone value)
3. US2 → Recurring jobs (cron + interval) — extends US1
4. US3 → Full dashboard management (execution history, edit) — extends US1
5. US4 → Telegram command parity — independent channel
6. US5 → Zaion global settings — independent config path
7. Polish → Safety, observability, docs

---

## Notes

- `[P]` tasks touch different files — safe to implement concurrently
- `[Story]` label maps each task to its user story for traceability
- Each user story is independently completable and testable — confirm via the corresponding quickstart.md scenario
- Commit after each task or logical group
- Stop at any phase checkpoint to validate independently before proceeding

**Remediations applied (from /speckit.analyze):**
- **C1** *(CRITICAL — Constitution)*: Added T041 (parser unit tests, Phase 2) and T042 (worker unit tests, Phase 3) — satisfies constitution "Core logic MUST have unit tests" quality gate
- **I1** *(HIGH)*: Moved T038 (preview endpoint) from Phase 8/Polish into Phase 3/US1 (inside T008 router) — ensures ChronosPreview component has a working backend before frontend components are built
- **I2** *(HIGH)*: Moved T036 (max_active_jobs enforcement) from Phase 8/Polish into Phase 2 — ensures FR-009 is enforced at every create path from the start of US1
- **U1** *(HIGH)*: Updated T026 with explicit chrono-node intent extraction strategy for `/chronos` command — splits prompt from time expression using chrono-node datetime detection, with TTL cleanup via setTimeout and full error messaging

**Total tasks: 42** (40 original + T041 + T042; T036 and T038 moved to earlier phases, not added)
