import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import type {
  Permission,
  GrantPermissionInput,
  ActionType,
  PermissionScope,
  ApprovalRequest,
  ApprovalStatus,
  ApprovalScope,
  CreateApprovalRequestInput,
} from './types.js';

export class PermissionStore {
  constructor(private db: Database.Database) {}

  // ─── Permissions ───────────────────────────────────────────────────────────

  grant(input: GrantPermissionInput): Permission {
    const id = randomUUID();
    const now = Date.now();

    this.db.prepare(`
      INSERT INTO permissions (id, action_type, scope, scope_id, granted_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      input.action_type,
      input.scope,
      input.scope_id ?? null,
      now,
      input.expires_at ?? null
    );

    return { id, ...input, granted_at: now };
  }

  /**
   * Check if an action is permitted.
   * Checks in order: global → project → session.
   */
  isGranted(action_type: ActionType, scope_id?: string): boolean {
    const now = Date.now();

    const row = this.db.prepare(`
      SELECT id FROM permissions
      WHERE action_type = ?
        AND (expires_at IS NULL OR expires_at > ?)
        AND (
          scope = 'global'
          OR (scope IN ('project', 'session') AND scope_id = ?)
        )
      LIMIT 1
    `).get(action_type, now, scope_id ?? null);

    return Boolean(row);
  }

  revoke(id: string): boolean {
    const result = this.db.prepare('DELETE FROM permissions WHERE id = ?').run(id);
    return result.changes > 0;
  }

  list(scope?: PermissionScope, scope_id?: string): Permission[] {
    let query = 'SELECT * FROM permissions WHERE 1=1';
    const params: any[] = [];
    if (scope) { query += ' AND scope = ?'; params.push(scope); }
    if (scope_id) { query += ' AND scope_id = ?'; params.push(scope_id); }
    query += ' ORDER BY granted_at DESC';
    return this.db.prepare(query).all(...params) as Permission[];
  }

  // ─── Approval Requests ─────────────────────────────────────────────────────

  createApprovalRequest(input: CreateApprovalRequestInput): ApprovalRequest {
    const id = randomUUID();
    const now = Date.now();

    this.db.prepare(`
      INSERT INTO approval_requests (
        id, task_id, session_id, action_type, action_description, status, created_at
      )
      VALUES (?, ?, ?, ?, ?, 'pending', ?)
    `).run(
      id,
      input.task_id,
      input.session_id,
      input.action_type,
      input.action_description,
      now
    );

    return {
      id,
      task_id: input.task_id,
      session_id: input.session_id,
      action_type: input.action_type,
      action_description: input.action_description,
      status: 'pending',
      created_at: now,
    };
  }

  getApprovalRequest(id: string): ApprovalRequest | undefined {
    const row = this.db.prepare('SELECT * FROM approval_requests WHERE id = ?').get(id) as any;
    return row ? this.deserializeApproval(row) : undefined;
  }

  getPendingApprovalRequests(sessionId?: string): ApprovalRequest[] {
    let query = `SELECT * FROM approval_requests WHERE status = 'pending'`;
    const params: any[] = [];
    if (sessionId) { query += ' AND session_id = ?'; params.push(sessionId); }
    query += ' ORDER BY created_at ASC';
    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map(r => this.deserializeApproval(r));
  }

  resolveApprovalRequest(
    id: string,
    status: 'approved' | 'denied' | 'approved_always',
    scope?: ApprovalScope,
    resolvedBy: string = 'user'
  ): ApprovalRequest | undefined {
    const now = Date.now();
    this.db.prepare(`
      UPDATE approval_requests
      SET status = ?, scope = ?, resolved_at = ?, resolved_by = ?
      WHERE id = ?
    `).run(status, scope ?? null, now, resolvedBy, id);

    const req = this.getApprovalRequest(id);

    // If approved_always, auto-create a permanent permission
    if (status === 'approved_always' && req) {
      const permScope: PermissionScope =
        scope === 'global' ? 'global'
        : scope === 'project' ? 'project'
        : 'session';

      this.grant({
        action_type: req.action_type as ActionType,
        scope: permScope,
        scope_id: permScope !== 'global' ? req.session_id : undefined,
      });
    }

    return req;
  }

  listApprovalRequests(sessionId?: string, status?: ApprovalStatus): ApprovalRequest[] {
    let query = 'SELECT * FROM approval_requests WHERE 1=1';
    const params: any[] = [];
    if (sessionId) { query += ' AND session_id = ?'; params.push(sessionId); }
    if (status) { query += ' AND status = ?'; params.push(status); }
    query += ' ORDER BY created_at DESC';
    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map(r => this.deserializeApproval(r));
  }

  private deserializeApproval(row: any): ApprovalRequest {
    return {
      id: row.id,
      task_id: row.task_id,
      session_id: row.session_id,
      action_type: row.action_type,
      action_description: row.action_description,
      status: row.status as ApprovalStatus,
      scope: row.scope ?? undefined,
      created_at: row.created_at,
      resolved_at: row.resolved_at ?? undefined,
      resolved_by: row.resolved_by ?? undefined,
    };
  }
}
