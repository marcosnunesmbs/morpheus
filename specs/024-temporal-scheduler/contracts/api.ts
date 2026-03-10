/**
 * Chronos API Contracts
 * HTTP endpoint request/response types for the Chronos temporal scheduler.
 *
 * Feature: 024-temporal-scheduler
 * Routes base: /api/chronos
 */

// ─── Core Types ──────────────────────────────────────────────────────────────

export type ScheduleType = 'once' | 'cron' | 'interval';
export type ExecutionStatus = 'running' | 'success' | 'failed' | 'timeout';
export type CreatedBy = 'ui' | 'telegram' | 'api';

// ─── ChronosJob ──────────────────────────────────────────────────────────────

export interface ChronosJob {
  id: string;
  prompt: string;
  schedule_type: ScheduleType;
  /** Original user input (natural language, cron string, or ISO datetime) */
  schedule_expression: string;
  /** Computed cron expression for recurring jobs; null for once-type */
  cron_normalized: string | null;
  timezone: string;
  /** Unix timestamp (ms) of next scheduled execution; null if disabled or completed */
  next_run_at: number | null;
  /** Unix timestamp (ms) of last execution attempt; null if never run */
  last_run_at: number | null;
  enabled: boolean;
  created_at: number;
  updated_at: number;
  created_by: CreatedBy;
}

// ─── ChronosExecution ────────────────────────────────────────────────────────

export interface ChronosExecution {
  id: string;
  job_id: string;
  triggered_at: number;
  completed_at: number | null;
  status: ExecutionStatus;
  error: string | null;
  session_id: string;
}

// ─── ChronosConfig ───────────────────────────────────────────────────────────

export interface ChronosConfig {
  /** Default IANA timezone for new jobs (e.g., 'America/Sao_Paulo') */
  timezone: string;
  /** How often the ChronosWorker polls for due jobs, in ms. Minimum: 60000 */
  check_interval_ms: number;
  /** Maximum number of simultaneously enabled jobs */
  max_active_jobs: number;
}

// ─── API: POST /api/chronos ──────────────────────────────────────────────────

export interface CreateChronosJobRequest {
  /** The prompt to send to Oracle when this job triggers */
  prompt: string;
  /** How this job is scheduled */
  schedule_type: ScheduleType;
  /**
   * The schedule expression. Accepts:
   * - `once`:     ISO 8601 datetime OR natural language (e.g., "tomorrow at 9am")
   * - `cron`:     5-field cron expression (e.g., "0 9 * * 1-5")
   * - `interval`: Human-readable interval (e.g., "every 30 minutes", "every day at 8am")
   */
  schedule_expression: string;
  /**
   * IANA timezone string. If omitted, uses the globally configured default timezone.
   * Example: "America/Sao_Paulo"
   */
  timezone?: string;
}

export interface CreateChronosJobResponse {
  job: ChronosJob;
  /** Human-readable interpretation of the schedule */
  human_readable: string;
  /** Formatted next run time in the job's timezone */
  next_run_formatted: string;
}

// ─── API: GET /api/chronos ───────────────────────────────────────────────────

export interface ListChronosJobsQuery {
  /** Filter by enabled state */
  enabled?: 'true' | 'false';
  /** Filter by origin channel */
  created_by?: CreatedBy;
}

export type ListChronosJobsResponse = ChronosJob[];

// ─── API: GET /api/chronos/:id ───────────────────────────────────────────────

export type GetChronosJobResponse = ChronosJob;

// ─── API: PUT /api/chronos/:id ───────────────────────────────────────────────

export interface UpdateChronosJobRequest {
  /** Updated prompt text */
  prompt?: string;
  /**
   * New schedule expression. Changing this recomputes `next_run_at` immediately.
   * Must be consistent with the existing `schedule_type`.
   */
  schedule_expression?: string;
  /** Enable or disable the job */
  enabled?: boolean;
  /** Override the job timezone */
  timezone?: string;
}

export type UpdateChronosJobResponse = ChronosJob;

// ─── API: DELETE /api/chronos/:id ────────────────────────────────────────────

export interface DeleteChronosJobResponse {
  success: true;
  deleted_id: string;
}

// ─── API: PATCH /api/chronos/:id/enable ─────────────────────────────────────

export type EnableChronosJobResponse = ChronosJob;

// ─── API: PATCH /api/chronos/:id/disable ────────────────────────────────────

export type DisableChronosJobResponse = ChronosJob;

// ─── API: GET /api/chronos/:id/executions ────────────────────────────────────

export interface GetChronosExecutionsQuery {
  /** Maximum number of records to return (default: 50, max: 100) */
  limit?: number;
}

export type GetChronosExecutionsResponse = ChronosExecution[];

// ─── API: GET /api/config/chronos ────────────────────────────────────────────

export type GetChronosConfigResponse = ChronosConfig;

// ─── API: POST /api/config/chronos ───────────────────────────────────────────

export interface UpdateChronosConfigRequest {
  /** IANA timezone string to use as default for new jobs */
  timezone?: string;
  /**
   * How often the ChronosWorker polls for due jobs, in milliseconds.
   * Minimum: 60000 (60 seconds). Applied immediately without restart.
   */
  check_interval_ms?: number;
  /** Maximum number of simultaneously active jobs (1–1000) */
  max_active_jobs?: number;
}

export type UpdateChronosConfigResponse = ChronosConfig;

// ─── Internal: ChronosWorker ─────────────────────────────────────────────────

export interface ChronosWorkerOptions {
  /** Override the check interval (ms). Falls back to config value. */
  pollIntervalMs?: number;
}

// ─── Internal: Schedule Parser ───────────────────────────────────────────────

export interface ParsedSchedule {
  /** Normalized schedule type inferred from the expression */
  type: ScheduleType;
  /** Next execution timestamp in ms (UTC) */
  next_run_at: number;
  /**
   * Normalized cron expression for recurring jobs.
   * Null for `once` type (no recurrence needed after first trigger).
   */
  cron_normalized: string | null;
  /** Human-readable description of the schedule (via cronstrue or formatted datetime) */
  human_readable: string;
}

export interface ParseScheduleOptions {
  /** IANA timezone for resolving relative expressions. Defaults to 'UTC'. */
  timezone?: string;
  /** Reference "now" timestamp for relative expressions. Defaults to Date.now(). */
  referenceDate?: number;
}
