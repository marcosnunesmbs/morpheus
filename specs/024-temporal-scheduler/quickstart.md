# Quickstart: Chronos — Temporal Intent Engine

**Feature**: 024-temporal-scheduler
**Branch**: `024-temporal-scheduler`

This guide describes how to verify the Chronos feature end-to-end after implementation.

---

## Prerequisites

1. Morpheus daemon running: `npm start` or `morpheus start`
2. Morpheus UI accessible at `http://localhost:4000` (or configured port)
3. (Optional) Telegram bot configured for Telegram command tests

---

## Scenario 1: Create and Trigger a One-Time Job (P1)

**Goal**: Verify the core scheduling loop works — a job is created, persisted, and the Oracle is invoked at the right time.

### Steps

1. Open the Morpheus UI → navigate to **Chronos** in the sidebar.
2. Click **"New Job"** → the Create Chronos Job modal opens.
3. Fill in:
   - **Prompt**: `"Say hello and report the current system time"`
   - **Schedule type**: `Once`
   - **Time**: type `in 2 minutes` in the natural language field
   - **Timezone**: leave as default (or set `America/Sao_Paulo`)
4. Verify the **preview** shows a computed next-run time approximately 2 minutes from now.
5. Click **Save**.
6. The job appears in the Chronos table with status **Enabled** and a `next_run_at` in ~2 minutes.
7. Wait 2 minutes.

### Expected Result

- The job's `last_run_at` updates to the trigger time.
- Job status becomes **Disabled** (one-time job auto-disables after trigger).
- A new execution record appears in the job's **History** panel with status `success`.
- The Oracle session `chronos-job-<jobId>` is visible in the Sessions page.

---

## Scenario 2: Create a Recurring Cron Job (P2)

**Goal**: Verify a recurring job keeps running and recomputes `next_run_at` after each trigger.

### Steps

1. Open the Create Chronos Job modal.
2. Fill in:
   - **Prompt**: `"Check if any git repos have uncommitted changes and report"`
   - **Schedule type**: `Recurring`
   - **Expression**: `*/2 * * * *` (every 2 minutes — use this for testing, not production)
   - **Timezone**: your local timezone
3. Verify the preview shows: "Every 2 minutes".
4. Save the job.
5. Wait 4–6 minutes.

### Expected Result

- The job triggers at least twice.
- Each trigger adds a new row to execution history.
- `next_run_at` advances to the next 2-minute mark after each trigger.
- Job remains **Enabled** throughout.

### Cleanup

Disable or delete the job after testing.

---

## Scenario 3: Disable and Re-enable a Job (P3 — Dashboard)

**Goal**: Verify the dashboard controls work correctly.

### Steps

1. With the recurring job from Scenario 2 still active, click **Disable** in the Chronos table row.
2. Verify the job's status changes to **Disabled** immediately.
3. Wait past the next scheduled time — confirm no new execution records appear.
4. Click **Enable** — verify `next_run_at` is recomputed to the next upcoming occurrence.
5. Wait for the next trigger — confirm execution resumes.

---

## Scenario 4: Telegram Commands (P4)

**Goal**: Verify Chronos is fully manageable via Telegram.

### Commands to Test

```
/chronos Remind me to review pull requests in 3 minutes
```
Expected: Bot replies with parsed schedule ("tomorrow" or "in 3 minutes") and asks for confirmation.

Reply: `yes` or `confirm`
Expected: Bot replies with job ID and `next_run_at` time.

```
/chronos_list
```
Expected: Formatted list of all active Chronos jobs with IDs and next-run times.

```
/chronos_disable <job_id>
```
Expected: Bot confirms job is disabled.

```
/chronos_enable <job_id>
```
Expected: Bot confirms job is enabled and shows new `next_run_at`.

```
/chronos_delete <job_id>
```
Expected: Bot confirms job is permanently deleted.

---

## Scenario 5: Global Chronos Settings in Zaion (P5)

**Goal**: Verify the timezone default is applied correctly.

### Steps

1. Open **Zaion** → navigate to the **Chronos** settings section.
2. Set **Default Timezone** to `America/Sao_Paulo`.
3. Set **Check Interval** to `60` seconds.
4. Save settings.
5. Create a new Chronos job with expression `"tomorrow at 9am"` (no explicit timezone).

### Expected Result

- The preview shows `9:00 AM in America/Sao_Paulo` (not UTC 9am).
- The stored `timezone` on the job is `America/Sao_Paulo`.

---

## Scenario 6: Validation and Error Handling

**Goal**: Confirm invalid inputs are rejected clearly.

| Input | Expected Error |
|-------|----------------|
| Cron: `* * * * *` (every minute) | "Minimum interval is 60 seconds" |
| Once: `yesterday at 9am` | "Scheduled time must be in the future" |
| Cron: `not a cron` | "Invalid cron expression" |
| Interval: `check_interval_ms = 30000` in Zaion | "Minimum check interval is 60 seconds" |

---

## Scenario 7: Restart Resilience

**Goal**: Verify no jobs are lost after a system restart.

### Steps

1. Create a recurring Chronos job (every 5 minutes).
2. Stop the Morpheus daemon: `morpheus stop`
3. Restart: `morpheus start`
4. Open the Chronos page — verify the job is still present and enabled.
5. Wait for the next trigger — verify it fires correctly.

### Expected Result

No jobs are lost. If the restart occurred while a job was due, it triggers within one check cycle after startup.

---

## Checking Execution Logs

All Chronos activity is logged via the Morpheus display/logging system. Look for `[Chronos]` prefixed lines in the Logs page or terminal output.

```
[Chronos] Worker started (interval: 60000ms)
[Chronos] Job <id> triggered — sending prompt to Oracle
[Chronos] Job <id> completed — status: success — next_run_at: <timestamp>
[Chronos] Job <id> auto-disabled (once-type, triggered successfully)
```
