import Database from 'better-sqlite3';
import fs from 'fs-extra';
import path from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';
import { ConfigManager } from '../../config/manager.js';

export type ScheduleType = 'once' | 'cron' | 'interval';
export type ExecutionStatus = 'running' | 'success' | 'failed' | 'timeout';
export type CreatedBy = 'ui' | 'telegram' | 'discord' | 'api' | 'oracle';

export interface ChronosJob {
  id: string;
  prompt: string;
  schedule_type: ScheduleType;
  schedule_expression: string;
  cron_normalized: string | null;
  timezone: string;
  next_run_at: number | null;
  last_run_at: number | null;
  enabled: boolean;
  created_at: number;
  updated_at: number;
  created_by: CreatedBy;
  /** Channels to notify on execution. Empty array = broadcast to all registered adapters. */
  notify_channels: string[];
}

export interface ChronosExecution {
  id: string;
  job_id: string;
  triggered_at: number;
  completed_at: number | null;
  status: ExecutionStatus;
  error: string | null;
  session_id: string;
}

export interface CreateJobInput {
  prompt: string;
  schedule_type: ScheduleType;
  schedule_expression: string;
  cron_normalized: string | null;
  timezone: string;
  next_run_at: number;
  created_by: CreatedBy;
  /** Channels to notify. Empty = broadcast to all. */
  notify_channels?: string[];
}

export interface JobFilters {
  enabled?: boolean;
  created_by?: CreatedBy;
}

export interface JobPatch {
  prompt?: string;
  schedule_expression?: string;
  cron_normalized?: string | null;
  timezone?: string;
  next_run_at?: number | null;
  last_run_at?: number | null;
  enabled?: boolean;
  notify_channels?: string[];
}

export class ChronosError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChronosError';
  }
}

export class ChronosRepository {
  private static instance: ChronosRepository | null = null;
  private db: Database.Database;

  private constructor() {
    const dbPath = path.join(homedir(), '.morpheus', 'memory', 'short-memory.db');
    fs.ensureDirSync(path.dirname(dbPath));
    this.db = new Database(dbPath, { timeout: 5000 });
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.ensureTable();
  }

  public static getInstance(): ChronosRepository {
    if (!ChronosRepository.instance) {
      ChronosRepository.instance = new ChronosRepository();
    }
    return ChronosRepository.instance;
  }

  private ensureTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chronos_jobs (
        id TEXT PRIMARY KEY
      );
    `);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chronos_executions (
        id TEXT PRIMARY KEY
      );
    `);
    this.migrateTable();
    this.ensureIndexes();
  }

  private migrateTable(): void {
    const jobInfo = this.db.pragma('table_info(chronos_jobs)') as Array<{ name: string }>;
    const jobCols = new Set(jobInfo.map((c) => c.name));
    const addJobCol = (sql: string, col: string) => {
      if (jobCols.has(col)) return;
      this.db.exec(sql);
      jobCols.add(col);
    };

    addJobCol(`ALTER TABLE chronos_jobs ADD COLUMN prompt TEXT NOT NULL DEFAULT ''`, 'prompt');
    addJobCol(`ALTER TABLE chronos_jobs ADD COLUMN schedule_type TEXT NOT NULL DEFAULT 'once'`, 'schedule_type');
    addJobCol(`ALTER TABLE chronos_jobs ADD COLUMN schedule_expression TEXT NOT NULL DEFAULT ''`, 'schedule_expression');
    addJobCol(`ALTER TABLE chronos_jobs ADD COLUMN cron_normalized TEXT`, 'cron_normalized');
    addJobCol(`ALTER TABLE chronos_jobs ADD COLUMN timezone TEXT NOT NULL DEFAULT 'UTC'`, 'timezone');
    addJobCol(`ALTER TABLE chronos_jobs ADD COLUMN next_run_at INTEGER`, 'next_run_at');
    addJobCol(`ALTER TABLE chronos_jobs ADD COLUMN last_run_at INTEGER`, 'last_run_at');
    addJobCol(`ALTER TABLE chronos_jobs ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1`, 'enabled');
    addJobCol(`ALTER TABLE chronos_jobs ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0`, 'created_at');
    addJobCol(`ALTER TABLE chronos_jobs ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0`, 'updated_at');
    addJobCol(`ALTER TABLE chronos_jobs ADD COLUMN created_by TEXT NOT NULL DEFAULT 'api'`, 'created_by');
    addJobCol(`ALTER TABLE chronos_jobs ADD COLUMN notify_channels TEXT NOT NULL DEFAULT '[]'`, 'notify_channels');

    const execInfo = this.db.pragma('table_info(chronos_executions)') as Array<{ name: string }>;
    const execCols = new Set(execInfo.map((c) => c.name));
    const addExecCol = (sql: string, col: string) => {
      if (execCols.has(col)) return;
      this.db.exec(sql);
      execCols.add(col);
    };

    addExecCol(`ALTER TABLE chronos_executions ADD COLUMN job_id TEXT NOT NULL DEFAULT ''`, 'job_id');
    addExecCol(`ALTER TABLE chronos_executions ADD COLUMN triggered_at INTEGER NOT NULL DEFAULT 0`, 'triggered_at');
    addExecCol(`ALTER TABLE chronos_executions ADD COLUMN completed_at INTEGER`, 'completed_at');
    addExecCol(`ALTER TABLE chronos_executions ADD COLUMN status TEXT NOT NULL DEFAULT 'running'`, 'status');
    addExecCol(`ALTER TABLE chronos_executions ADD COLUMN error TEXT`, 'error');
    addExecCol(`ALTER TABLE chronos_executions ADD COLUMN session_id TEXT NOT NULL DEFAULT ''`, 'session_id');
  }

  private ensureIndexes(): void {
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_chronos_jobs_next_run
        ON chronos_jobs (enabled, next_run_at);
      CREATE INDEX IF NOT EXISTS idx_chronos_jobs_created_by
        ON chronos_jobs (created_by);
      CREATE INDEX IF NOT EXISTS idx_chronos_executions_job
        ON chronos_executions (job_id, triggered_at DESC);
    `);
  }

  private deserializeJob(row: any): ChronosJob {
    let notify_channels: string[] = [];
    try { notify_channels = JSON.parse(row.notify_channels || '[]'); } catch { /* keep [] */ }
    return {
      id: row.id,
      prompt: row.prompt,
      schedule_type: row.schedule_type as ScheduleType,
      schedule_expression: row.schedule_expression,
      cron_normalized: row.cron_normalized ?? null,
      timezone: row.timezone,
      next_run_at: row.next_run_at ?? null,
      last_run_at: row.last_run_at ?? null,
      enabled: row.enabled === 1,
      created_at: row.created_at,
      updated_at: row.updated_at,
      created_by: row.created_by as CreatedBy,
      notify_channels,
    };
  }

  private deserializeExecution(row: any): ChronosExecution {
    return {
      id: row.id,
      job_id: row.job_id,
      triggered_at: row.triggered_at,
      completed_at: row.completed_at ?? null,
      status: row.status as ExecutionStatus,
      error: row.error ?? null,
      session_id: row.session_id,
    };
  }

  // ─── T036: max_active_jobs enforcement ────────────────────────────────────

  createJob(input: CreateJobInput): ChronosJob {
    const cfg = ConfigManager.getInstance().getChronosConfig();
    const activeCount = (this.db.prepare(`SELECT COUNT(*) as cnt FROM chronos_jobs WHERE enabled = 1`).get() as any).cnt as number;
    if (activeCount >= cfg.max_active_jobs) {
      throw new ChronosError(
        `Maximum active jobs limit (${cfg.max_active_jobs}) reached. Disable or delete an existing job first.`
      );
    }

    const now = Date.now();
    const id = randomUUID();
    this.db.prepare(`
      INSERT INTO chronos_jobs (
        id, prompt, schedule_type, schedule_expression, cron_normalized,
        timezone, next_run_at, last_run_at, enabled, created_at, updated_at, created_by, notify_channels
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 1, ?, ?, ?, ?)
    `).run(
      id,
      input.prompt,
      input.schedule_type,
      input.schedule_expression,
      input.cron_normalized ?? null,
      input.timezone,
      input.next_run_at,
      now,
      now,
      input.created_by,
      JSON.stringify(input.notify_channels ?? []),
    );
    return this.getJob(id)!;
  }

  getJob(id: string): ChronosJob | null {
    const row = this.db.prepare('SELECT * FROM chronos_jobs WHERE id = ?').get(id) as any;
    return row ? this.deserializeJob(row) : null;
  }

  listJobs(filters?: JobFilters): ChronosJob[] {
    const params: any[] = [];
    let query = 'SELECT * FROM chronos_jobs WHERE 1=1';
    if (filters?.enabled !== undefined) {
      query += ' AND enabled = ?';
      params.push(filters.enabled ? 1 : 0);
    }
    if (filters?.created_by) {
      query += ' AND created_by = ?';
      params.push(filters.created_by);
    }
    query += ' ORDER BY created_at DESC';
    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map((r) => this.deserializeJob(r));
  }

  updateJob(id: string, patch: JobPatch): ChronosJob | null {
    const now = Date.now();
    const sets: string[] = ['updated_at = ?'];
    const params: any[] = [now];

    if (patch.prompt !== undefined) { sets.push('prompt = ?'); params.push(patch.prompt); }
    if (patch.schedule_expression !== undefined) { sets.push('schedule_expression = ?'); params.push(patch.schedule_expression); }
    if ('cron_normalized' in patch) { sets.push('cron_normalized = ?'); params.push(patch.cron_normalized ?? null); }
    if (patch.timezone !== undefined) { sets.push('timezone = ?'); params.push(patch.timezone); }
    if ('next_run_at' in patch) { sets.push('next_run_at = ?'); params.push(patch.next_run_at ?? null); }
    if ('last_run_at' in patch) { sets.push('last_run_at = ?'); params.push(patch.last_run_at ?? null); }
    if (patch.enabled !== undefined) { sets.push('enabled = ?'); params.push(patch.enabled ? 1 : 0); }
    if (patch.notify_channels !== undefined) { sets.push('notify_channels = ?'); params.push(JSON.stringify(patch.notify_channels)); }

    params.push(id);
    this.db.prepare(`UPDATE chronos_jobs SET ${sets.join(', ')} WHERE id = ?`).run(...params);
    return this.getJob(id);
  }

  deleteJob(id: string): boolean {
    const result = this.db.prepare('DELETE FROM chronos_jobs WHERE id = ?').run(id);
    return result.changes > 0;
  }

  getDueJobs(nowMs: number): ChronosJob[] {
    const rows = this.db.prepare(`
      SELECT * FROM chronos_jobs
      WHERE enabled = 1 AND next_run_at IS NOT NULL AND next_run_at <= ?
      ORDER BY next_run_at ASC
    `).all(nowMs) as any[];
    return rows.map((r) => this.deserializeJob(r));
  }

  enableJob(id: string): ChronosJob | null {
    const now = Date.now();
    this.db.prepare(`UPDATE chronos_jobs SET enabled = 1, updated_at = ? WHERE id = ?`).run(now, id);
    return this.getJob(id);
  }

  disableJob(id: string): ChronosJob | null {
    const now = Date.now();
    this.db.prepare(`UPDATE chronos_jobs SET enabled = 0, next_run_at = NULL, updated_at = ? WHERE id = ?`).run(now, id);
    return this.getJob(id);
  }

  // ─── Executions ───────────────────────────────────────────────────────────

  insertExecution(record: Omit<ChronosExecution, 'completed_at' | 'error'>): void {
    this.db.prepare(`
      INSERT INTO chronos_executions (id, job_id, triggered_at, completed_at, status, error, session_id)
      VALUES (?, ?, ?, NULL, ?, NULL, ?)
    `).run(record.id, record.job_id, record.triggered_at, record.status, record.session_id);
  }

  completeExecution(id: string, status: ExecutionStatus, error?: string): void {
    const now = Date.now();
    this.db.prepare(`
      UPDATE chronos_executions SET status = ?, completed_at = ?, error = ? WHERE id = ?
    `).run(status, now, error ?? null, id);
  }

  listExecutions(jobId: string, limit = 50): ChronosExecution[] {
    const rows = this.db.prepare(`
      SELECT * FROM chronos_executions WHERE job_id = ?
      ORDER BY triggered_at DESC LIMIT ?
    `).all(jobId, Math.min(limit, 100)) as any[];
    return rows.map((r) => this.deserializeExecution(r));
  }

  pruneExecutions(jobId: string, keepCount: number): void {
    this.db.prepare(`
      DELETE FROM chronos_executions
      WHERE job_id = ? AND id NOT IN (
        SELECT id FROM chronos_executions
        WHERE job_id = ?
        ORDER BY triggered_at DESC
        LIMIT ?
      )
    `).run(jobId, jobId, keepCount);
  }

  close(): void {
    this.db.close();
  }
}
