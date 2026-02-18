/**
 * Shared synchronous SQLite database connection for stores and utilities.
 * Uses the same DB file as SQLiteChatMessageHistory.
 */
import Database from 'better-sqlite3';
import * as path from 'path';
import { homedir } from 'os';
import fs from 'fs-extra';

const DB_PATH = path.join(homedir(), '.morpheus', 'memory', 'short-memory.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    fs.ensureDirSync(path.dirname(DB_PATH));
    _db = new Database(DB_PATH, { timeout: 5000 });
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
  }
  return _db;
}
