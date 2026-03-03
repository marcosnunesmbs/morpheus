import Database from 'better-sqlite3';
import fs from 'fs-extra';
import path from 'path';
import { homedir } from 'os';
import { ConfigManager } from '../../config/manager.js';

export class SetupRepository {
  private static instance: SetupRepository | null = null;
  private db: Database.Database;

  private constructor(dbPath?: string) {
    const resolvedPath = dbPath ?? path.join(homedir(), '.morpheus', 'memory', 'short-memory.db');
    fs.ensureDirSync(path.dirname(resolvedPath));
    this.db = new Database(resolvedPath, { timeout: 5000 });
    this.db.pragma('journal_mode = WAL');
    this.initialize();
  }

  public static getInstance(dbPath?: string): SetupRepository {
    if (!SetupRepository.instance) {
      SetupRepository.instance = new SetupRepository(dbPath);
    }
    return SetupRepository.instance;
  }

  /** Exposed for testing and explicit DB initialization. Called automatically in constructor. */
  public initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS setup_state (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        field      TEXT    NOT NULL UNIQUE,
        value      TEXT,
        created_at INTEGER NOT NULL
      )
    `);
  }

  /**
   * Returns true if setup is disabled in config OR if '__completed__' flag exists in DB.
   */
  public isCompleted(): boolean {
    const cfg = ConfigManager.getInstance().getSetupConfig();
    if (!cfg.enabled) return true;

    const row = this.db
      .prepare(`SELECT 1 FROM setup_state WHERE field = '__completed__' LIMIT 1`)
      .get();
    return !!row;
  }

  /**
   * Saves a single field/value to setup_state. Upserts on conflict.
   */
  public saveField(field: string, value: string): void {
    this.db
      .prepare(
        `INSERT INTO setup_state (field, value, created_at)
         VALUES (?, ?, ?)
         ON CONFLICT(field) DO UPDATE SET value = excluded.value, created_at = excluded.created_at`
      )
      .run(field, value, Date.now());
  }

  /**
   * Returns the list of configured fields not yet present in setup_state.
   */
  public getMissingFields(): string[] {
    const cfg = ConfigManager.getInstance().getSetupConfig();
    if (!cfg.enabled) return [];

    const saved = this.db
      .prepare(`SELECT field FROM setup_state WHERE field != '__completed__'`)
      .all() as { field: string }[];

    const savedSet = new Set(saved.map((r) => r.field));
    return cfg.fields.filter((f) => !savedSet.has(f));
  }

  /**
   * Inserts the __completed__ flag (idempotent — uses INSERT OR IGNORE).
   */
  public markCompleted(): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO setup_state (field, value, created_at)
         VALUES ('__completed__', '1', ?)`
      )
      .run(Date.now());
  }

  /**
   * Deletes all setup_state records (used by Danger Zone factory reset).
   */
  public reset(): void {
    this.db.prepare(`DELETE FROM setup_state`).run();
  }

  /** For testing cleanup. */
  public static resetInstance(): void {
    SetupRepository.instance = null;
  }
}
