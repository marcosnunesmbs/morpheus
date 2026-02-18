import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import type { Project, CreateProjectInput, UpdateProjectInput } from './types.js';

export class ProjectStore {
  constructor(private db: Database.Database) {}

  create(input: CreateProjectInput): Project {
    const id = randomUUID();
    const now = Date.now();
    const allowed_commands = JSON.stringify(input.allowed_commands ?? []);

    this.db.prepare(`
      INSERT INTO projects (id, name, path, description, git_remote,
        active_worktree, allowed_commands, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)
    `).run(
      id,
      input.name,
      input.path,
      input.description ?? null,
      input.git_remote ?? null,
      allowed_commands,
      now,
      now
    );

    return this.getById(id)!;
  }

  getById(id: string): Project | undefined {
    const row = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;
    return row ? this.deserialize(row) : undefined;
  }

  list(): Project[] {
    const rows = this.db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all() as any[];
    return rows.map(r => this.deserialize(r));
  }

  update(id: string, input: UpdateProjectInput): Project | undefined {
    const existing = this.getById(id);
    if (!existing) return undefined;

    const now = Date.now();
    const fields: string[] = ['updated_at = ?'];
    const values: any[] = [now];

    if (input.name !== undefined) { fields.push('name = ?'); values.push(input.name); }
    if (input.path !== undefined) { fields.push('path = ?'); values.push(input.path); }
    if (input.description !== undefined) { fields.push('description = ?'); values.push(input.description); }
    if (input.git_remote !== undefined) { fields.push('git_remote = ?'); values.push(input.git_remote); }
    if (input.active_worktree !== undefined) { fields.push('active_worktree = ?'); values.push(input.active_worktree); }
    if (input.allowed_commands !== undefined) {
      fields.push('allowed_commands = ?');
      values.push(JSON.stringify(input.allowed_commands));
    }

    values.push(id);
    this.db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.getById(id);
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    return result.changes > 0;
  }

  private deserialize(row: any): Project {
    return {
      ...row,
      allowed_commands: (() => {
        try { return JSON.parse(row.allowed_commands || '[]'); }
        catch { return []; }
      })(),
      description: row.description ?? undefined,
      git_remote: row.git_remote ?? undefined,
      active_worktree: row.active_worktree ?? undefined,
    };
  }
}
