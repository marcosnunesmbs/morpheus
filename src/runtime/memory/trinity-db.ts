import Database from 'better-sqlite3';
import fs from 'fs-extra';
import path from 'path';
import { homedir } from 'os';
import { encrypt, decrypt, canEncrypt } from '../trinity-crypto.js';

export type DatabaseType = 'postgresql' | 'mysql' | 'sqlite' | 'mongodb';

export interface DatabaseRecord {
  id: number;
  name: string;
  type: DatabaseType;
  host: string | null;
  port: number | null;
  database_name: string | null;
  username: string | null;
  /** Decrypted password (never stored as plaintext) */
  password: string | null;
  /** Decrypted connection string (never stored as plaintext) */
  connection_string: string | null;
  schema_json: string | null;
  schema_updated_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface DatabaseCreateInput {
  name: string;
  type: DatabaseType;
  host?: string | null;
  port?: number | null;
  database_name?: string | null;
  username?: string | null;
  password?: string | null;
  connection_string?: string | null;
}

export interface DatabaseUpdateInput extends Partial<DatabaseCreateInput> {}

/** Raw row from SQLite (passwords are encrypted) */
interface DatabaseRow {
  id: number;
  name: string;
  type: string;
  host: string | null;
  port: number | null;
  database_name: string | null;
  username: string | null;
  password_encrypted: string | null;
  connection_string_encrypted: string | null;
  schema_json: string | null;
  schema_updated_at: number | null;
  created_at: number;
  updated_at: number;
}

function safeDecrypt(value: string | null): string | null {
  if (!value) return null;
  try {
    return decrypt(value);
  } catch {
    return null;
  }
}

function rowToRecord(row: DatabaseRow): DatabaseRecord {
  return {
    id: row.id,
    name: row.name,
    type: row.type as DatabaseType,
    host: row.host,
    port: row.port,
    database_name: row.database_name,
    username: row.username,
    password: safeDecrypt(row.password_encrypted),
    connection_string: safeDecrypt(row.connection_string_encrypted),
    schema_json: row.schema_json,
    schema_updated_at: row.schema_updated_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export class DatabaseRegistry {
  private static instance: DatabaseRegistry | null = null;
  private db: Database.Database;

  private constructor() {
    const dbPath = path.join(homedir(), '.morpheus', 'memory', 'trinity.db');
    fs.ensureDirSync(path.dirname(dbPath));
    this.db = new Database(dbPath, { timeout: 5000 });
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.ensureTable();
  }

  public static getInstance(): DatabaseRegistry {
    if (!DatabaseRegistry.instance) {
      DatabaseRegistry.instance = new DatabaseRegistry();
    }
    return DatabaseRegistry.instance;
  }

  private ensureTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS databases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        host TEXT,
        port INTEGER,
        database_name TEXT,
        username TEXT,
        password_encrypted TEXT,
        connection_string_encrypted TEXT,
        schema_json TEXT,
        schema_updated_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
  }

  listDatabases(): DatabaseRecord[] {
    const rows = this.db.prepare('SELECT * FROM databases ORDER BY name ASC').all() as DatabaseRow[];
    return rows.map(rowToRecord);
  }

  getDatabase(id: number): DatabaseRecord | null {
    const row = this.db.prepare('SELECT * FROM databases WHERE id = ?').get(id) as DatabaseRow | undefined;
    return row ? rowToRecord(row) : null;
  }

  getDatabaseByName(name: string): DatabaseRecord | null {
    const row = this.db.prepare('SELECT * FROM databases WHERE name = ?').get(name) as DatabaseRow | undefined;
    return row ? rowToRecord(row) : null;
  }

  createDatabase(data: DatabaseCreateInput): DatabaseRecord {
    if ((data.password || data.connection_string) && !canEncrypt()) {
      throw new Error(
        'MORPHEUS_SECRET must be set to store database credentials. ' +
        'Add MORPHEUS_SECRET to your environment before saving credentials.'
      );
    }

    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO databases (
        name, type, host, port, database_name, username,
        password_encrypted, connection_string_encrypted,
        schema_json, schema_updated_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)
    `);

    const result = stmt.run(
      data.name,
      data.type,
      data.host ?? null,
      data.port ?? null,
      data.database_name ?? null,
      data.username ?? null,
      data.password ? encrypt(data.password) : null,
      data.connection_string ? encrypt(data.connection_string) : null,
      now,
      now,
    );

    return this.getDatabase(result.lastInsertRowid as number)!;
  }

  updateDatabase(id: number, data: DatabaseUpdateInput): DatabaseRecord | null {
    const existing = this.getDatabase(id);
    if (!existing) return null;

    if ((data.password || data.connection_string) && !canEncrypt()) {
      throw new Error('MORPHEUS_SECRET must be set to update database credentials.');
    }

    const now = Date.now();

    // Build dynamic update
    const fields: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.type !== undefined) { fields.push('type = ?'); values.push(data.type); }
    if (data.host !== undefined) { fields.push('host = ?'); values.push(data.host); }
    if (data.port !== undefined) { fields.push('port = ?'); values.push(data.port); }
    if (data.database_name !== undefined) { fields.push('database_name = ?'); values.push(data.database_name); }
    if (data.username !== undefined) { fields.push('username = ?'); values.push(data.username); }
    if (data.password !== undefined) {
      fields.push('password_encrypted = ?');
      values.push(data.password ? encrypt(data.password) : null);
    }
    if (data.connection_string !== undefined) {
      fields.push('connection_string_encrypted = ?');
      values.push(data.connection_string ? encrypt(data.connection_string) : null);
    }

    if (fields.length === 0) return existing;

    fields.push('updated_at = ?');
    values.push(now);
    values.push(id);

    this.db.prepare(`UPDATE databases SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.getDatabase(id);
  }

  deleteDatabase(id: number): boolean {
    const result = this.db.prepare('DELETE FROM databases WHERE id = ?').run(id);
    return result.changes > 0;
  }

  updateSchema(id: number, schemaJson: string): void {
    const now = Date.now();
    this.db.prepare(
      'UPDATE databases SET schema_json = ?, schema_updated_at = ?, updated_at = ? WHERE id = ?'
    ).run(schemaJson, now, now, id);
  }
}
