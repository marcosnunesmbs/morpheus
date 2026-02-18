import Database from 'better-sqlite3';
import path from 'path';
import { homedir } from 'os';
import fs from 'fs-extra';
import { randomUUID } from 'crypto';
import type {
  Webhook,
  WebhookNotification,
  NotificationStatus,
  CreateWebhookInput,
  UpdateWebhookInput,
} from './types.js';

export class WebhookRepository {
  private static instance: WebhookRepository | null = null;
  private db: Database.Database;

  private constructor() {
    const dbPath = path.join(homedir(), '.morpheus', 'memory', 'short-memory.db');
    fs.ensureDirSync(path.dirname(dbPath));
    this.db = new Database(dbPath, { timeout: 5000 });
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.ensureTables();
  }

  public static getInstance(): WebhookRepository {
    if (!WebhookRepository.instance) {
      WebhookRepository.instance = new WebhookRepository();
    }
    return WebhookRepository.instance;
  }

  private ensureTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS webhooks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        api_key TEXT NOT NULL UNIQUE,
        prompt TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        notification_channels TEXT NOT NULL DEFAULT '["ui"]',
        created_at INTEGER NOT NULL,
        last_triggered_at INTEGER,
        trigger_count INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_webhooks_name ON webhooks(name);
      CREATE INDEX IF NOT EXISTS idx_webhooks_api_key ON webhooks(api_key);

      CREATE TABLE IF NOT EXISTS webhook_notifications (
        id TEXT PRIMARY KEY,
        webhook_id TEXT NOT NULL,
        webhook_name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        payload TEXT NOT NULL,
        result TEXT,
        read INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        completed_at INTEGER,
        FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_webhook_notifications_webhook_id
        ON webhook_notifications(webhook_id);
      CREATE INDEX IF NOT EXISTS idx_webhook_notifications_read
        ON webhook_notifications(read);
      CREATE INDEX IF NOT EXISTS idx_webhook_notifications_created_at
        ON webhook_notifications(created_at DESC);
    `);
  }

  // ─── Webhook CRUD ────────────────────────────────────────────────────────────

  createWebhook(data: CreateWebhookInput): Webhook {
    const id = randomUUID();
    const api_key = randomUUID();
    const now = Date.now();

    this.db.prepare(`
      INSERT INTO webhooks (id, name, api_key, prompt, enabled, notification_channels, created_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `).run(
      id,
      data.name,
      api_key,
      data.prompt,
      JSON.stringify(data.notification_channels),
      now,
    );

    return this.getWebhookById(id)!;
  }

  listWebhooks(): Webhook[] {
    const rows = this.db.prepare(
      'SELECT * FROM webhooks ORDER BY created_at DESC',
    ).all() as any[];
    return rows.map(this.deserializeWebhook);
  }

  getWebhookById(id: string): Webhook | null {
    const row = this.db.prepare('SELECT * FROM webhooks WHERE id = ?').get(id) as any;
    return row ? this.deserializeWebhook(row) : null;
  }

  getWebhookByName(name: string): Webhook | null {
    const row = this.db.prepare('SELECT * FROM webhooks WHERE name = ?').get(name) as any;
    return row ? this.deserializeWebhook(row) : null;
  }

  /**
   * Looks up a webhook by name, then validates the api_key and enabled status.
   * Returns null if not found, disabled, or api_key mismatch (caller decides error code).
   */
  getAndValidateWebhook(name: string, api_key: string): Webhook | null {
    const row = this.db.prepare(
      'SELECT * FROM webhooks WHERE name = ? AND enabled = 1',
    ).get(name) as any;
    if (!row) return null;
    const wh = this.deserializeWebhook(row);
    if (wh.api_key !== api_key) return null;
    return wh;
  }

  updateWebhook(id: string, data: UpdateWebhookInput): Webhook | null {
    const existing = this.getWebhookById(id);
    if (!existing) return null;

    const name = data.name ?? existing.name;
    const prompt = data.prompt ?? existing.prompt;
    const enabled = data.enabled !== undefined ? (data.enabled ? 1 : 0) : (existing.enabled ? 1 : 0);
    const notification_channels = JSON.stringify(
      data.notification_channels ?? existing.notification_channels,
    );

    this.db.prepare(`
      UPDATE webhooks
      SET name = ?, prompt = ?, enabled = ?, notification_channels = ?
      WHERE id = ?
    `).run(name, prompt, enabled, notification_channels, id);

    return this.getWebhookById(id);
  }

  deleteWebhook(id: string): boolean {
    const result = this.db.prepare('DELETE FROM webhooks WHERE id = ?').run(id);
    return result.changes > 0;
  }

  recordTrigger(webhookId: string): void {
    this.db.prepare(`
      UPDATE webhooks
      SET trigger_count = trigger_count + 1, last_triggered_at = ?
      WHERE id = ?
    `).run(Date.now(), webhookId);
  }

  private deserializeWebhook(row: any): Webhook {
    return {
      id: row.id,
      name: row.name,
      api_key: row.api_key,
      prompt: row.prompt,
      enabled: Boolean(row.enabled),
      notification_channels: JSON.parse(row.notification_channels || '["ui"]'),
      created_at: row.created_at,
      last_triggered_at: row.last_triggered_at ?? null,
      trigger_count: row.trigger_count ?? 0,
    };
  }

  // ─── Notification CRUD ───────────────────────────────────────────────────────

  createNotification(data: Pick<WebhookNotification, 'webhook_id' | 'webhook_name' | 'payload'>): WebhookNotification {
    const id = randomUUID();
    this.db.prepare(`
      INSERT INTO webhook_notifications
        (id, webhook_id, webhook_name, status, payload, read, created_at)
      VALUES (?, ?, ?, 'pending', ?, 0, ?)
    `).run(id, data.webhook_id, data.webhook_name, data.payload, Date.now());
    return this.getNotificationById(id)!;
  }

  updateNotificationResult(id: string, status: NotificationStatus, result: string): void {
    this.db.prepare(`
      UPDATE webhook_notifications
      SET status = ?, result = ?, completed_at = ?
      WHERE id = ?
    `).run(status, result, Date.now(), id);
  }

  listNotifications(filters?: { webhookId?: string; unreadOnly?: boolean }): WebhookNotification[] {
    let query = 'SELECT * FROM webhook_notifications WHERE 1=1';
    const params: any[] = [];

    if (filters?.webhookId) {
      query += ' AND webhook_id = ?';
      params.push(filters.webhookId);
    }
    if (filters?.unreadOnly) {
      query += ' AND read = 0';
    }

    query += ' ORDER BY created_at DESC LIMIT 500';

    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map(this.deserializeNotification);
  }

  getNotificationById(id: string): WebhookNotification | null {
    const row = this.db.prepare(
      'SELECT * FROM webhook_notifications WHERE id = ?',
    ).get(id) as any;
    return row ? this.deserializeNotification(row) : null;
  }

  markNotificationsRead(ids: string[]): void {
    const stmt = this.db.prepare(
      'UPDATE webhook_notifications SET read = 1 WHERE id = ?',
    );
    const tx = this.db.transaction((list: string[]) => {
      for (const id of list) stmt.run(id);
    });
    tx(ids);
  }

  countUnread(): number {
    const row = this.db.prepare(
      'SELECT COUNT(*) as cnt FROM webhook_notifications WHERE read = 0',
    ).get() as any;
    return row?.cnt ?? 0;
  }

  private deserializeNotification(row: any): WebhookNotification {
    return {
      id: row.id,
      webhook_id: row.webhook_id,
      webhook_name: row.webhook_name,
      status: row.status as NotificationStatus,
      payload: row.payload,
      result: row.result ?? null,
      read: Boolean(row.read),
      created_at: row.created_at,
      completed_at: row.completed_at ?? null,
    };
  }

  close(): void {
    this.db.close();
  }
}
