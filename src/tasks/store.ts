import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import type { Task, CreateTaskInput, UpdateTaskInput, TaskFilter, TaskStatus } from './types.js';

export class TaskStore {
  constructor(private db: Database.Database) {}

  create(input: CreateTaskInput): Task {
    const id = randomUUID();
    const now = Date.now();

    this.db.prepare(`
      INSERT INTO tasks (
        id, project_id, session_id, parent_task_id, created_by,
        assigned_to, title, description, blueprint, status,
        requires_approval, working_dir, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
    `).run(
      id,
      input.project_id ?? null,
      input.session_id,
      input.parent_task_id ?? null,
      input.created_by,
      input.assigned_to ?? null,
      input.title,
      input.description ?? null,
      input.blueprint ?? null,
      input.requires_approval ? 1 : 0,
      input.working_dir ?? null,
      now,
      now
    );

    return this.getById(id)!;
  }

  getById(id: string): Task | undefined {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
    return row ? this.deserialize(row) : undefined;
  }

  list(filter?: TaskFilter): Task[] {
    let query = 'SELECT * FROM tasks WHERE 1=1';
    const params: any[] = [];

    if (filter?.session_id) { query += ' AND session_id = ?'; params.push(filter.session_id); }
    if (filter?.project_id) { query += ' AND project_id = ?'; params.push(filter.project_id); }
    if (filter?.status) { query += ' AND status = ?'; params.push(filter.status); }
    if (filter?.assigned_to) { query += ' AND assigned_to = ?'; params.push(filter.assigned_to); }

    query += ' ORDER BY created_at ASC';
    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map(r => this.deserialize(r));
  }

  update(id: string, input: UpdateTaskInput): Task | undefined {
    const now = Date.now();
    const fields: string[] = ['updated_at = ?'];
    const values: any[] = [now];

    const optionalFields = [
      'assigned_to', 'status', 'blueprint', 'result', 'error',
      'started_at', 'completed_at', 'approved_at', 'approved_by'
    ] as const;

    for (const field of optionalFields) {
      if (input[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(input[field]);
      }
    }

    values.push(id);
    this.db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.getById(id);
  }

  nextPending(projectId?: string): Task | undefined {
    let query = `SELECT * FROM tasks WHERE status = 'pending'`;
    const params: any[] = [];
    if (projectId) { query += ' AND project_id = ?'; params.push(projectId); }
    query += ' ORDER BY created_at ASC LIMIT 1';
    const row = this.db.prepare(query).get(...params) as any;
    return row ? this.deserialize(row) : undefined;
  }

  listByStatus(status: TaskStatus): Task[] {
    const rows = this.db.prepare('SELECT * FROM tasks WHERE status = ? ORDER BY created_at ASC').all(status) as any[];
    return rows.map(r => this.deserialize(r));
  }

  private deserialize(row: any): Task {
    return {
      id: row.id,
      project_id: row.project_id ?? undefined,
      session_id: row.session_id,
      parent_task_id: row.parent_task_id ?? undefined,
      created_by: row.created_by,
      assigned_to: row.assigned_to ?? undefined,
      title: row.title,
      description: row.description ?? undefined,
      blueprint: row.blueprint ?? undefined,
      status: row.status as TaskStatus,
      requires_approval: Boolean(row.requires_approval),
      approved_at: row.approved_at ?? undefined,
      approved_by: row.approved_by ?? undefined,
      result: row.result ?? undefined,
      error: row.error ?? undefined,
      working_dir: row.working_dir ?? undefined,
      started_at: row.started_at ?? undefined,
      completed_at: row.completed_at ?? undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}
