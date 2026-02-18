import { EventEmitter } from 'events';
import { getDb } from '../runtime/memory/db.js';
import type { ApprovalStatus } from '../permissions/types.js';

export const approvalEventEmitter = new EventEmitter();

export interface ApprovalNeededPayload {
  sessionId: string;
  approvalId: string;
  actionType: string;
  actionDescription: string;
  taskId: string;
}

const POLL_INTERVAL_MS = 2_000;
const MAX_WAIT_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Called by Apoc/Merovingian when an action needs user approval.
 * Blocks until the user approves or denies (via chat or UI).
 */
export async function requestApproval(params: {
  taskId: string;
  sessionId: string;
  actionType: string;
  actionDescription: string;
}): Promise<'approved' | 'denied'> {
  const { taskId, sessionId, actionType, actionDescription } = params;

  const db = getDb();

  // 1. Check if a persistent permission already exists
  const existing = db
    .prepare(
      `SELECT id FROM permissions
       WHERE action_type = ?
         AND (scope = 'global'
           OR (scope = 'session' AND scope_id = ?)
           OR (scope = 'project' AND scope_id = (
                SELECT project_id FROM tasks WHERE id = ? LIMIT 1
              ))
         )
         AND (expires_at IS NULL OR expires_at > ?)
       LIMIT 1`,
    )
    .get(actionType, sessionId, taskId, Date.now());

  if (existing) {
    return 'approved';
  }

  // 2. Create the approval request
  const id = `apr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();

  db.prepare(
    `INSERT INTO approval_requests (id, task_id, session_id, action_type, action_description, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
  ).run(id, taskId, sessionId, actionType, actionDescription, now);

  // 3. Emit event so Oracle can proactively message the user
  const payload: ApprovalNeededPayload = {
    approvalId: id,
    sessionId,
    actionType,
    actionDescription,
    taskId,
  };
  approvalEventEmitter.emit('approval_needed', payload);

  // 4. Poll DB until resolved or timeout
  const deadline = Date.now() + MAX_WAIT_MS;

  return new Promise<'approved' | 'denied'>((resolve) => {
    const interval = setInterval(() => {
      if (Date.now() > deadline) {
        clearInterval(interval);
        // Auto-deny on timeout
        db.prepare(`UPDATE approval_requests SET status = 'denied', resolved_at = ? WHERE id = ?`).run(
          Date.now(),
          id,
        );
        resolve('denied');
        return;
      }

      const row = db
        .prepare(`SELECT status FROM approval_requests WHERE id = ?`)
        .get(id) as { status: ApprovalStatus } | undefined;

      if (row && row.status !== 'pending') {
        clearInterval(interval);
        resolve(
          row.status === 'approved' || row.status === 'approved_always' ? 'approved' : 'denied',
        );
      }
    }, POLL_INTERVAL_MS);
  });
}

/**
 * Get pending approvals for a session (used by Oracle to check for pending requests).
 */
export function getPendingApprovals(sessionId: string) {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM approval_requests
       WHERE session_id = ? AND status = 'pending'
       ORDER BY created_at ASC`,
    )
    .all(sessionId) as Array<{
    id: string;
    task_id: string;
    session_id: string;
    action_type: string;
    action_description: string;
    status: string;
    created_at: number;
  }>;
}
