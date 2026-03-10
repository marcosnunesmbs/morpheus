# Feature Specification: Chronos — Temporal Intent Engine

**Feature Branch**: `024-temporal-scheduler`
**Created**: 2026-02-21
**Status**: Draft
**Input**: User description: "Chronos — Temporal Intent Engine for scheduled prompts, with global Chronos settings in Zaion (default timezone and check interval)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create a One-Time Scheduled Prompt (Priority: P1)

A user wants Morpheus to execute a specific prompt at a future date and time — for example, a reminder, a one-time report, or a delayed task. The user provides a natural language time expression or an exact datetime, along with the prompt to be executed. Morpheus confirms the interpreted schedule, persists the job, and automatically triggers the prompt at the right moment.

**Why this priority**: This is the foundational capability that delivers immediate, tangible value — users get a personal assistant that acts on their behalf at a specific time, even when they are away.

**Independent Test**: Can be fully tested by creating a one-time Chronos job (e.g., "run this prompt in 2 minutes"), waiting for execution, and verifying the Oracle is invoked at the correct time with the stored prompt.

**Acceptance Scenarios**:

1. **Given** a user provides a prompt and a future datetime, **When** they submit the job, **Then** Chronos saves the job with the correct next-run time and returns a confirmation with the human-readable interpretation.
2. **Given** a one-time job reaches its scheduled time, **When** Chronos checks for due jobs, **Then** the stored prompt is sent to the Oracle for execution and the job is automatically disabled after triggering.
3. **Given** a user creates a job with a natural language expression (e.g., "tomorrow at 9am"), **When** Chronos parses it, **Then** the computed next-run time is correctly resolved in the user's configured timezone and shown in the confirmation.
4. **Given** a user's configured timezone is set in global preferences, **When** a time-specific job is created without an explicit timezone, **Then** the global timezone is used as the default.

---

### User Story 2 - Create and Manage Recurring Chronos Jobs (Priority: P2)

A user wants to automate recurring tasks — daily reports, weekly reminders, periodic system checks — by creating a cron or interval-based Chronos job. The system continuously re-triggers the prompt at each occurrence and keeps the job active until the user explicitly disables or deletes it.

**Why this priority**: Recurring jobs are the core automation capability that transforms Morpheus from a reactive tool into a proactive assistant running long-term workflows.

**Independent Test**: Can be fully tested by creating a recurring Chronos job (e.g., every 5 minutes), observing multiple executions, and verifying the job remains active and triggers correctly each cycle.

**Acceptance Scenarios**:

1. **Given** a user provides a cron expression or interval, **When** they create the Chronos job, **Then** the system validates the expression, computes the next-run time, and confirms the job is active.
2. **Given** a recurring job executes successfully, **When** the trigger completes, **Then** Chronos updates the last-run time and recalculates the next-run time for the following occurrence.
3. **Given** a user attempts to create a job with an interval shorter than 1 minute, **When** they submit it, **Then** Chronos rejects the request with a clear explanation of the minimum interval constraint.
4. **Given** a user disables a recurring Chronos job, **When** the next scheduled time passes, **Then** Chronos does not trigger the prompt and the job remains in the disabled state.

---

### User Story 3 - Manage Chronos Jobs via the Web Dashboard (Priority: P3)

A user manages all their Chronos jobs from the Morpheus web dashboard. They can see a list of all jobs (active and disabled), view next and last execution times, create new jobs through a modal form, edit existing ones, toggle enable/disable, delete jobs, and view the execution history of each job.

**Why this priority**: The dashboard provides visibility and control for all automated jobs. Without it, users cannot audit, adjust, or troubleshoot their workflows through a visual interface.

**Independent Test**: Can be fully tested by navigating to the Chronos section, creating a job through the UI form, verifying it appears in the list with correct metadata, toggling its status, and deleting it.

**Acceptance Scenarios**:

1. **Given** a user opens the Chronos section, **When** the page loads, **Then** all existing jobs are displayed in a table with: prompt summary, human-readable schedule expression, next run time, last run time, status, and source (UI/Telegram/API).
2. **Given** a user opens the Create Chronos Job modal, **When** they type a natural language time expression, **Then** the preview section shows the computed next execution time and a human-readable interpretation before saving.
3. **Given** a user submits the create form with valid data, **When** the form is saved, **Then** the new job appears in the list immediately with correct status.
4. **Given** a user clicks "Disable" on an active job, **When** the action completes, **Then** the job status changes to disabled and no further executions occur.
5. **Given** a user clicks "View history" on a job, **When** the history panel opens, **Then** past executions are listed with their timestamps and outcomes.

---

### User Story 4 - Manage Chronos Jobs via Telegram (Priority: P4)

A user manages their Chronos jobs entirely through Telegram commands — creating new jobs with natural language descriptions, listing active jobs, viewing details, and disabling or deleting jobs — without needing to open the web dashboard.

**Why this priority**: Telegram is the primary conversational interface for Morpheus. Users should be able to create Chronos automations on-the-go from their mobile device just as easily as from the web UI.

**Independent Test**: Can be fully tested by sending `/chronos <prompt + time>` in Telegram, receiving a confirmation with the interpreted schedule, then using `/chronos_list` to verify it appears, and `/chronos_delete <id>` to remove it.

**Acceptance Scenarios**:

1. **Given** a user sends `/chronos Me lembre de pagar o boleto amanhã às 9h`, **When** the system processes the command, **Then** Chronos confirms the parsed schedule in a human-readable format and asks for confirmation before persisting.
2. **Given** a user confirms the interpreted schedule, **When** confirmed, **Then** the job is saved and Telegram responds with the job ID and next-run time.
3. **Given** a user sends `/chronos_list`, **When** the command executes, **Then** Telegram responds with a formatted list of active jobs showing their IDs, prompt summaries, and next-run times.
4. **Given** a user sends `/chronos_disable <id>` or `/chronos_enable <id>`, **When** the command executes, **Then** the job status is toggled and Telegram confirms the change.
5. **Given** a user sends `/chronos_delete <id>`, **When** the command executes, **Then** the job is permanently removed and Telegram confirms the deletion.

---

### User Story 5 - Configure Global Chronos Preferences in Zaion (Priority: P5)

A user configures their global Chronos defaults in the Zaion settings page: their preferred timezone and the Chronos check interval. These preferences are automatically applied when creating new jobs without explicit timezone or interval overrides, ensuring all time-based jobs behave consistently with the user's local context.

**Why this priority**: Without a default timezone, users creating jobs from natural language expressions (e.g., "tomorrow at 9am") would get incorrect execution times. These global settings provide a safe, predictable baseline for all Chronos operations.

**Independent Test**: Can be fully tested by setting a timezone in Zaion, creating a Chronos job with "tomorrow at 9am" (no explicit timezone), and verifying the computed next-run time matches the expected local time.

**Acceptance Scenarios**:

1. **Given** a user opens Zaion settings, **When** they navigate to the Chronos section, **Then** they see controls for default timezone (searchable dropdown) and Chronos check interval (numeric input with unit selector).
2. **Given** a user sets their default timezone to "America/Sao_Paulo", **When** they save the setting, **Then** all subsequent jobs created without an explicit timezone use "America/Sao_Paulo" as the default.
3. **Given** a user changes the Chronos check interval to 60 seconds, **When** saved, **Then** Chronos evaluates due jobs every 60 seconds instead of the previous interval.
4. **Given** a user attempts to set an interval below the minimum (60 seconds), **When** they submit, **Then** the system rejects the value with a message explaining the minimum constraint.

---

### Edge Cases

- What happens when a job's next-run time passes while the system is offline? The job is triggered on the next Chronos cycle after restart (single catch-up execution, not repeated for missed cycles).
- What happens if the Oracle fails or times out during a triggered execution? The failure is recorded in the job's execution history; the job remains active for future cycles.
- What happens if two Chronos cycles overlap (slow Oracle invocation)? Internal locking prevents the same job from being triggered twice concurrently within the same cycle.
- What happens when a user provides an invalid cron expression? Chronos immediately returns a validation error with a hint about correct format; the job is never saved.
- What happens if a user creates jobs beyond the maximum active limit? Chronos returns a clear error explaining the limit; the new job is not saved.
- What happens when a natural language expression is ambiguous (e.g., "next Friday")? Chronos shows the interpreted datetime in a confirmation preview and requires explicit user approval before saving.
- What happens when no global timezone is configured and no explicit timezone is provided at job creation? Chronos defaults to UTC and informs the user of the assumption in the confirmation.

---

## Requirements *(mandatory)*

### Functional Requirements

**Chronos Core**

- **FR-001**: Chronos MUST persist jobs with the following attributes: unique identifier, prompt text, schedule type (once/cron/interval), schedule expression, timezone, next execution time, last execution time, enabled state, creation timestamp, update timestamp, and origin (UI/Telegram/API).
- **FR-002**: Chronos MUST run a background check cycle at a configurable interval (minimum 60 seconds, default 60 seconds) to evaluate and trigger due jobs.
- **FR-003**: Chronos MUST send the stored prompt to the Oracle whenever a job's next execution time is reached and the job is enabled.
- **FR-004**: Chronos MUST update each job's last execution time after triggering and recalculate the next execution time for recurring jobs.
- **FR-005**: Chronos MUST automatically disable one-time jobs after they are triggered, retaining the job record for history purposes.
- **FR-006**: Chronos MUST prevent the same job from being triggered more than once concurrently, even if check cycles overlap.
- **FR-007**: Chronos MUST recover all active jobs and resume correctly after a restart, without losing or duplicating any persisted job.
- **FR-008**: Chronos MUST reject any job with a recurrence interval shorter than 60 seconds and return an informative error message.
- **FR-009**: Chronos MUST enforce a maximum number of simultaneously active jobs and reject new jobs that exceed this limit with a clear error.

**Schedule Expressions**

- **FR-010**: Chronos MUST accept cron expressions as schedule inputs for recurring jobs.
- **FR-011**: Chronos MUST accept ISO 8601 datetime strings as inputs for one-time jobs.
- **FR-012**: Chronos MUST accept human-readable interval expressions (e.g., "every 30 minutes", "every 2 hours") as inputs for recurring jobs.
- **FR-013**: Chronos MUST parse natural language time expressions (e.g., "tomorrow at 9am", "every Monday at 8am") and convert them to structured schedules, resolving time against the job's timezone.
- **FR-014**: Chronos MUST validate all schedule expressions before saving and return an informative error for invalid inputs.

**API**

- **FR-015**: The system MUST expose an endpoint to create a new Chronos job (POST /api/chronos).
- **FR-016**: The system MUST expose an endpoint to list all Chronos jobs with optional filters for enabled state and origin (GET /api/chronos).
- **FR-017**: The system MUST expose an endpoint to retrieve a single job by ID (GET /api/chronos/:id).
- **FR-018**: The system MUST expose an endpoint to update a job's prompt, schedule expression, or enabled state (PUT /api/chronos/:id).
- **FR-019**: The system MUST expose an endpoint to permanently delete a job (DELETE /api/chronos/:id).
- **FR-020**: The system MUST expose endpoints to individually enable or disable a job (PATCH /api/chronos/:id/enable and PATCH /api/chronos/:id/disable).

**Web Dashboard**

- **FR-021**: The dashboard MUST include a **Chronos** section displaying all jobs in a table with: prompt summary, human-readable schedule expression, next run time, last run time, status, and origin.
- **FR-022**: The dashboard MUST provide a **Create Chronos Job** modal with fields for: prompt text, schedule type (once/recurring), time input accepting both natural language and cron expression, and timezone selector.
- **FR-023**: The Create Chronos Job modal MUST show a live preview of the computed next execution time and a human-readable interpretation as the user types the schedule expression.
- **FR-024**: The dashboard MUST allow users to edit a job's prompt, expression, and enabled state.
- **FR-025**: The dashboard MUST allow users to enable, disable, and delete any job from the Chronos list.
- **FR-026**: The dashboard MUST allow users to view the execution history of each Chronos job, showing timestamps and outcomes.

**Telegram**

- **FR-027**: The system MUST support a `/chronos <prompt + time>` command that parses the user's intent, presents the interpreted schedule for confirmation, and persists the job only after confirmation.
- **FR-028**: The system MUST support a `/chronos_list` command that returns a list of active jobs with IDs, prompt summaries, and next-run times.
- **FR-029**: The system MUST support `/chronos_view <id>`, `/chronos_disable <id>`, `/chronos_enable <id>`, and `/chronos_delete <id>` commands for per-job management.

**Zaion Global Settings**

- **FR-030**: The Zaion settings page MUST include a **Chronos** section with a searchable timezone selector (defaulting to UTC) and a check interval input.
- **FR-031**: Chronos MUST use the globally configured timezone as the default when a new job is created without an explicit timezone.
- **FR-032**: Chronos MUST apply the globally configured check interval to its background loop without requiring a restart.
- **FR-033**: Chronos MUST reject check interval values below 60 seconds with an informative error message.

### Key Entities

- **Chronos Job**: Represents a user's temporal intention — a prompt to be executed at a specific time or on a recurring schedule. Carries the prompt content, schedule definition (type + expression), execution metadata (last/next run times), enabled state, origin, and timezone.
- **Schedule Expression**: The time definition for a Chronos job. Can be a one-time datetime, a repeating cron pattern, or a human-readable interval. Always resolved against the job's timezone.
- **Execution Record**: A history entry for a Chronos job capturing the trigger timestamp and the outcome of the Oracle invocation (success/failure/timeout).
- **Chronos Global Settings**: User-level preferences — default timezone and check interval — applied as defaults for all new Chronos jobs and for the Chronos loop behavior.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can create a Chronos job in under 60 seconds from opening the Create Chronos Job modal to receiving a confirmation.
- **SC-002**: Chronos jobs are triggered within one check cycle of their due time (maximum drift equals the configured check interval, default 60 seconds).
- **SC-003**: 100% of active jobs are recovered and resume correctly after a system restart, with no jobs lost or duplicated.
- **SC-004**: No job is triggered more than once per scheduled occurrence under any conditions, including concurrent Chronos cycles.
- **SC-005**: Natural language time expressions are always confirmed with the user before saving — zero silent misinterpretations reach production.
- **SC-006**: The Chronos section loads and displays all jobs in under 3 seconds on the dashboard.
- **SC-007**: All job management operations (create, edit, enable/disable, delete, view history) are fully available via both the web dashboard and Telegram, with no feature gaps between channels.
- **SC-008**: Changing the global timezone in Zaion is reflected in all subsequent Chronos job creations immediately, without requiring a restart.
- **SC-009**: 100% of invalid schedule expressions are rejected before saving, and no invalid job is ever persisted.
- **SC-010**: Chronos handles at least 50 simultaneously active jobs without execution delays or missed triggers.

---

## Assumptions

- The user base is a single-user local deployment. The "maximum active jobs" limit is a safety constraint against accidental overload, not a multi-tenant quota system.
- Natural language time parsing uses the globally configured timezone when no explicit timezone is provided at job creation.
- The Chronos background loop runs within the existing Morpheus daemon process — no separate process or external scheduler service is required.
- Execution history retention defaults to the last 100 executions per job; the exact retention policy can be refined during planning.
- The Telegram confirmation flow for `/chronos` follows a two-message pattern (Chronos presents parsed interpretation → user replies to confirm), consistent with existing Telegram interaction patterns in Morpheus.
- Disabling a one-time job after it triggers means the job record is retained for history inspection, not permanently deleted.
- The minimum 60-second interval rule applies uniformly to all schedule types (cron, interval, once), effectively preventing high-frequency cron abuse.
- Chronos global settings (timezone, check interval) are stored within the existing Zaion/config system under a new `chronos` namespace.
