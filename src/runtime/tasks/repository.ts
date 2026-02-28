import Database from 'better-sqlite3';
import fs from 'fs-extra';
import path from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';
import type { TaskCreateInput, TaskFilters, TaskRecord, TaskStats } from './types.js';

export class TaskRepository {
  private static instance: TaskRepository | null = null;
  private db: Database.Database;

  private constructor() {
    const dbPath = path.join(homedir(), '.morpheus', 'memory', 'short-memory.db');
    fs.ensureDirSync(path.dirname(dbPath));
    this.db = new Database(dbPath, { timeout: 5000 });
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.ensureTables();
  }

  public static getInstance(): TaskRepository {
    if (!TaskRepository.instance) {
      TaskRepository.instance = new TaskRepository();
    }
    return TaskRepository.instance;
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY
      );
    `);

    this.migrateTasksTable();
    this.ensureIndexes();
  }

  private migrateTasksTable(): void {
    const tableInfo = this.db.pragma('table_info(tasks)') as Array<{ name: string }>;
    const columns = new Set(tableInfo.map((c) => c.name));
    const addColumn = (sql: string, column: string) => {
      if (columns.has(column)) return;
      this.db.exec(sql);
      columns.add(column);
    };

    addColumn(`ALTER TABLE tasks ADD COLUMN agent TEXT NOT NULL DEFAULT 'apoc'`, 'agent');
    addColumn(`ALTER TABLE tasks ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'`, 'status');
    addColumn(`ALTER TABLE tasks ADD COLUMN input TEXT NOT NULL DEFAULT ''`, 'input');
    addColumn(`ALTER TABLE tasks ADD COLUMN context TEXT`, 'context');
    addColumn(`ALTER TABLE tasks ADD COLUMN output TEXT`, 'output');
    addColumn(`ALTER TABLE tasks ADD COLUMN error TEXT`, 'error');
    addColumn(`ALTER TABLE tasks ADD COLUMN origin_channel TEXT NOT NULL DEFAULT 'api'`, 'origin_channel');
    addColumn(`ALTER TABLE tasks ADD COLUMN session_id TEXT NOT NULL DEFAULT 'default'`, 'session_id');
    addColumn(`ALTER TABLE tasks ADD COLUMN origin_message_id TEXT`, 'origin_message_id');
    addColumn(`ALTER TABLE tasks ADD COLUMN origin_user_id TEXT`, 'origin_user_id');
    addColumn(`ALTER TABLE tasks ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0`, 'attempt_count');
    addColumn(`ALTER TABLE tasks ADD COLUMN max_attempts INTEGER NOT NULL DEFAULT 3`, 'max_attempts');
    addColumn(`ALTER TABLE tasks ADD COLUMN available_at INTEGER NOT NULL DEFAULT 0`, 'available_at');
    addColumn(`ALTER TABLE tasks ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0`, 'created_at');
    addColumn(`ALTER TABLE tasks ADD COLUMN started_at INTEGER`, 'started_at');
    addColumn(`ALTER TABLE tasks ADD COLUMN finished_at INTEGER`, 'finished_at');
    addColumn(`ALTER TABLE tasks ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0`, 'updated_at');
    addColumn(`ALTER TABLE tasks ADD COLUMN worker_id TEXT`, 'worker_id');
    addColumn(`ALTER TABLE tasks ADD COLUMN notify_status TEXT NOT NULL DEFAULT 'pending'`, 'notify_status');
    addColumn(`ALTER TABLE tasks ADD COLUMN notify_attempts INTEGER NOT NULL DEFAULT 0`, 'notify_attempts');
    addColumn(`ALTER TABLE tasks ADD COLUMN notify_last_error TEXT`, 'notify_last_error');
    addColumn(`ALTER TABLE tasks ADD COLUMN notified_at INTEGER`, 'notified_at');
    addColumn(`ALTER TABLE tasks ADD COLUMN notify_after_at INTEGER`, 'notify_after_at');
    addColumn(`ALTER TABLE tasks ADD COLUMN ack_sent INTEGER NOT NULL DEFAULT 0`, 'ack_sent');
    addColumn(`ALTER TABLE tasks ADD COLUMN provider TEXT`, 'provider');
    addColumn(`ALTER TABLE tasks ADD COLUMN model TEXT`, 'model');
    addColumn(`ALTER TABLE tasks ADD COLUMN input_tokens INTEGER NOT NULL DEFAULT 0`, 'input_tokens');
    addColumn(`ALTER TABLE tasks ADD COLUMN output_tokens INTEGER NOT NULL DEFAULT 0`, 'output_tokens');
    addColumn(`ALTER TABLE tasks ADD COLUMN duration_ms INTEGER`, 'duration_ms');
    addColumn(`ALTER TABLE tasks ADD COLUMN step_count INTEGER NOT NULL DEFAULT 0`, 'step_count');

    this.db.exec(`
      UPDATE tasks
      SET
        created_at = CASE WHEN created_at = 0 THEN strftime('%s','now') * 1000 ELSE created_at END,
        updated_at = CASE WHEN updated_at = 0 THEN strftime('%s','now') * 1000 ELSE updated_at END,
        available_at = CASE WHEN available_at = 0 THEN created_at ELSE available_at END
      WHERE created_at = 0 OR updated_at = 0 OR available_at = 0
    `);
  }

  private ensureIndexes(): void {
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_tasks_status_available_at
        ON tasks(status, available_at, created_at);
      CREATE INDEX IF NOT EXISTS idx_tasks_origin
        ON tasks(origin_channel, session_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_created_at
        ON tasks(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_tasks_notify
        ON tasks(status, notify_status, finished_at);
    `);
  }

  private deserializeTask(row: any): TaskRecord {
    return {
      id: row.id,
      agent: row.agent,
      status: row.status,
      input: row.input,
      context: row.context ?? null,
      output: row.output ?? null,
      error: row.error ?? null,
      origin_channel: row.origin_channel,
      session_id: row.session_id,
      origin_message_id: row.origin_message_id ?? null,
      origin_user_id: row.origin_user_id ?? null,
      attempt_count: row.attempt_count ?? 0,
      max_attempts: row.max_attempts ?? 3,
      available_at: row.available_at,
      created_at: row.created_at,
      started_at: row.started_at ?? null,
      finished_at: row.finished_at ?? null,
      updated_at: row.updated_at,
      worker_id: row.worker_id ?? null,
      notify_status: row.notify_status,
      notify_attempts: row.notify_attempts ?? 0,
      notify_last_error: row.notify_last_error ?? null,
      notified_at: row.notified_at ?? null,
      notify_after_at: row.notify_after_at ?? null,
      ack_sent: row.ack_sent === 1,
    };
  }

  /**
   * Grace period (ms) added to created_at for channels where the Oracle's
   * acknowledgement and the task result share the same delivery path (e.g. Telegram).
   * Channels with a synchronous ack (ui, api, cli, webhook) don't need this delay.
   */
  static readonly DEFAULT_NOTIFY_AFTER_MS = 1_000;
  private static readonly CHANNELS_NEEDING_ACK_GRACE = new Set(['telegram', 'discord']);

  createTask(input: TaskCreateInput): TaskRecord {
    const now = Date.now();
    const id = randomUUID();
    const needsAck = TaskRepository.CHANNELS_NEEDING_ACK_GRACE.has(input.origin_channel);
    const notify_after_at = input.notify_after_at !== undefined
      ? input.notify_after_at
      : needsAck
        ? now + TaskRepository.DEFAULT_NOTIFY_AFTER_MS
        : null;
    // ack_sent starts as 0 (blocked) for channels that send an ack message (telegram, discord).
    // For other channels (ui, api, webhook, cli) there is no ack to wait for, so start as 1 (free).
    const ack_sent = needsAck ? 0 : 1;

    this.db.prepare(`
      INSERT INTO tasks (
        id, agent, status, input, context, output, error,
        origin_channel, session_id, origin_message_id, origin_user_id,
        attempt_count, max_attempts, available_at,
        created_at, started_at, finished_at, updated_at, worker_id,
        notify_status, notify_attempts, notify_last_error, notified_at,
        notify_after_at, ack_sent
      ) VALUES (
        ?, ?, 'pending', ?, ?, NULL, NULL,
        ?, ?, ?, ?,
        0, ?, ?,
        ?, NULL, NULL, ?, NULL,
        'pending', 0, NULL, NULL,
        ?, ?
      )
    `).run(
      id,
      input.agent,
      input.input,
      input.context ?? null,
      input.origin_channel,
      input.session_id,
      input.origin_message_id ?? null,
      input.origin_user_id ?? null,
      input.max_attempts ?? 3,
      now,
      now,
      now,
      notify_after_at,
      ack_sent,
    );

    return this.getTaskById(id)!;
  }

  getTaskById(id: string): TaskRecord | null {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
    return row ? this.deserializeTask(row) : null;
  }

  findTaskByOriginMessageId(originMessageId: string): TaskRecord | null {
    const row = this.db.prepare(
      'SELECT * FROM tasks WHERE origin_message_id = ? LIMIT 1',
    ).get(originMessageId) as any;
    return row ? this.deserializeTask(row) : null;
  }

  listTasks(filters?: TaskFilters): TaskRecord[] {
    const params: any[] = [];
    let query = 'SELECT * FROM tasks WHERE 1=1';

    if (filters?.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters?.agent) {
      query += ' AND agent = ?';
      params.push(filters.agent);
    }
    if (filters?.origin_channel) {
      query += ' AND origin_channel = ?';
      params.push(filters.origin_channel);
    }
    if (filters?.session_id) {
      query += ' AND session_id = ?';
      params.push(filters.session_id);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(filters?.limit ?? 200);

    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map((row) => this.deserializeTask(row));
  }

  getStats(): TaskStats {
    const rows = this.db.prepare(`
      SELECT status, COUNT(*) as cnt
      FROM tasks
      GROUP BY status
    `).all() as Array<{ status: string; cnt: number }>;

    const stats: TaskStats = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      total: 0,
    };

    for (const row of rows) {
      const status = row.status as keyof TaskStats;
      if (status in stats) {
        (stats as any)[status] = row.cnt;
      }
      stats.total += row.cnt;
    }

    return stats;
  }

  /** Mark ack as sent for a list of task IDs, unblocking them for execution. */
  markAckSent(ids: string[]): void {
    if (ids.length === 0) return;
    const placeholders = ids.map(() => '?').join(', ');
    this.db.prepare(
      `UPDATE tasks SET ack_sent = 1, updated_at = ? WHERE id IN (${placeholders})`
    ).run(Date.now(), ...ids);
  }

  /** Fallback grace period (ms): tasks older than this run even without ack_sent. */
  static readonly ACK_FALLBACK_MS = 60_000;

  claimNextPending(workerId: string): TaskRecord | null {
    const now = Date.now();
    const tx = this.db.transaction(() => {
      const row = this.db.prepare(`
        SELECT id
        FROM tasks
        WHERE status = 'pending'
          AND available_at <= ?
          AND (ack_sent = 1 OR created_at <= ?)
        ORDER BY created_at ASC
        LIMIT 1
      `).get(now, now - TaskRepository.ACK_FALLBACK_MS) as { id: string } | undefined;

      if (!row) return null;

      const result = this.db.prepare(`
        UPDATE tasks
        SET status = 'running',
            started_at = COALESCE(started_at, ?),
            updated_at = ?,
            worker_id = ?,
            attempt_count = attempt_count + 1
        WHERE id = ? AND status = 'pending'
      `).run(now, now, workerId, row.id);

      if (result.changes === 0) {
        return null;
      }

      return this.getTaskById(row.id);
    });

    return tx();
  }

  markCompleted(id: string, output: string, usage?: {
    provider?: string;
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    durationMs?: number;
    stepCount?: number;
  }): void {
    const now = Date.now();
    const normalizedOutput = (output ?? '').trim();
    this.db.prepare(`
      UPDATE tasks
      SET status = 'completed',
          output = ?,
          error = NULL,
          finished_at = ?,
          updated_at = ?,
          notify_status = 'pending',
          notify_last_error = NULL,
          notified_at = NULL,
          provider = COALESCE(?, provider),
          model = COALESCE(?, model),
          input_tokens = COALESCE(?, input_tokens),
          output_tokens = COALESCE(?, output_tokens),
          duration_ms = COALESCE(?, duration_ms),
          step_count = COALESCE(?, step_count)
      WHERE id = ? AND status != 'cancelled'
    `).run(
      normalizedOutput.length > 0 ? normalizedOutput : 'Task completed without output.',
      now, now,
      usage?.provider ?? null,
      usage?.model ?? null,
      usage?.inputTokens ?? null,
      usage?.outputTokens ?? null,
      usage?.durationMs ?? null,
      usage?.stepCount ?? null,
      id,
    );
  }

  markFailed(id: string, error: string): void {
    const now = Date.now();
    this.db.prepare(`
      UPDATE tasks
      SET status = 'failed',
          error = ?,
          finished_at = ?,
          updated_at = ?,
          notify_status = 'pending',
          notified_at = NULL
      WHERE id = ? AND status != 'cancelled'
    `).run(error, now, now, id);
  }

  cancelTask(id: string): boolean {
    const now = Date.now();
    const result = this.db.prepare(`
      UPDATE tasks
      SET status = 'cancelled',
          finished_at = ?,
          updated_at = ?,
          notify_status = 'pending',
          notified_at = NULL
      WHERE id = ? AND status IN ('pending', 'running')
    `).run(now, now, id);
    return result.changes > 0;
  }

  retryTask(id: string): boolean {
    const now = Date.now();
    const result = this.db.prepare(`
      UPDATE tasks
      SET status = 'pending',
          output = NULL,
          error = NULL,
          finished_at = NULL,
          started_at = NULL,
          updated_at = ?,
          available_at = ?,
          worker_id = NULL
      WHERE id = ? AND status = 'failed'
    `).run(now, now, id);
    return result.changes > 0;
  }

  requeueForRetry(id: string, error: string, delayMs: number): void {
    const now = Date.now();
    this.db.prepare(`
      UPDATE tasks
      SET status = 'pending',
          error = ?,
          output = NULL,
          updated_at = ?,
          available_at = ?,
          worker_id = NULL
      WHERE id = ?
    `).run(error, now, now + Math.max(0, delayMs), id);
  }

  recoverStaleRunning(staleMs: number): number {
    const now = Date.now();
    const result = this.db.prepare(`
      UPDATE tasks
      SET status = 'pending',
          updated_at = ?,
          available_at = ?,
          worker_id = NULL,
          error = COALESCE(error, 'Recovered from stale running state')
      WHERE status = 'running'
        AND started_at IS NOT NULL
        AND started_at <= ?
    `).run(now, now, now - staleMs);

    return result.changes;
  }

  claimNextNotificationCandidate(minFinishedAgeMs: number = 0): TaskRecord | null {
    const now = Date.now();
    const tx = this.db.transaction(() => {
      const row = this.db.prepare(`
        SELECT id
        FROM tasks
        WHERE status IN ('completed', 'failed', 'cancelled')
          AND notify_status = 'pending'
          AND finished_at IS NOT NULL
          AND finished_at <= ?
          AND (notify_after_at IS NULL OR notify_after_at <= ?)
        ORDER BY finished_at ASC
        LIMIT 1
      `).get(now - Math.max(0, minFinishedAgeMs), now) as { id: string } | undefined;

      if (!row) return null;

      const changed = this.db.prepare(`
        UPDATE tasks
        SET notify_status = 'sending',
            notify_last_error = NULL,
            updated_at = ?
        WHERE id = ? AND notify_status = 'pending'
      `).run(Date.now(), row.id);

      if (changed.changes === 0) {
        return null;
      }

      return this.getTaskById(row.id);
    });

    return tx();
  }

  recoverNotificationQueue(maxAttempts: number, staleSendingMs: number): number {
    const now = Date.now();
    const staleThreshold = now - Math.max(0, staleSendingMs);

    const result = this.db.prepare(`
      UPDATE tasks
      SET notify_status = 'pending',
          notify_last_error = COALESCE(notify_last_error, 'Recovered notification queue state'),
          updated_at = ?
      WHERE status IN ('completed', 'failed', 'cancelled')
        AND (
          (notify_status = 'sending' AND updated_at <= ?)
          OR
          (notify_status = 'failed' AND notify_attempts < ?)
        )
    `).run(now, staleThreshold, Math.max(1, maxAttempts));

    return result.changes;
  }

  markNotificationSent(taskId: string): void {
    const now = Date.now();
    this.db.prepare(`
      UPDATE tasks
      SET notify_status = 'sent',
          notified_at = ?,
          updated_at = ?
      WHERE id = ?
    `).run(now, now, taskId);
  }

  markNotificationFailed(taskId: string, error: string, retry: boolean): void {
    const now = Date.now();
    this.db.prepare(`
      UPDATE tasks
      SET notify_status = ?,
          notify_attempts = notify_attempts + 1,
          notify_last_error = ?,
          updated_at = ?
      WHERE id = ?
    `).run(retry ? 'pending' : 'failed', error, now, taskId);
  }

  close(): void {
    this.db.close();
  }
}

