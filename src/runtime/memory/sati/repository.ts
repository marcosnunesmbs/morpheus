import Database from 'better-sqlite3';
import path from 'path';
import { homedir } from 'os';
import fs from 'fs-extra';
import { randomUUID } from 'crypto'; // Available in recent Node versions
import { IMemoryRecord, MemoryCategory, MemoryImportance } from './types.js';

export class SatiRepository {
  private db: Database.Database | null = null;
  private dbPath: string;
  private static instance: SatiRepository;

  private constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(homedir(), '.morpheus', 'memory', 'santi-memory.db');
  }

  public static getInstance(dbPath?: string): SatiRepository {
    if (!SatiRepository.instance) {
      SatiRepository.instance = new SatiRepository(dbPath);
    }
    return SatiRepository.instance;
  }

  public initialize(): void {
    try {
      // Ensure directory exists
      fs.ensureDirSync(path.dirname(this.dbPath));

      // Connect to database
      this.db = new Database(this.dbPath, { timeout: 5000 });
      this.db.pragma('journal_mode = WAL');

      // Create schema
      this.createSchema();
    } catch (error) {
      console.error(`[SatiRepository] Failed to initialize database: ${error}`);
      throw error;
    }
  }

  private createSchema() {
    if (!this.db) throw new Error("DB not initialized");

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS long_term_memory (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        importance TEXT NOT NULL,
        summary TEXT NOT NULL,
        details TEXT,
        hash TEXT NOT NULL UNIQUE,
        source TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_accessed_at TEXT,
        access_count INTEGER DEFAULT 0,
        version INTEGER DEFAULT 1,
        archived INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_memory_category ON long_term_memory(category);
      CREATE INDEX IF NOT EXISTS idx_memory_importance ON long_term_memory(importance);
      CREATE INDEX IF NOT EXISTS idx_memory_archived ON long_term_memory(archived);

      -- FTS5 Virtual Table for semantic-like keyword search
      CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(summary, content='long_term_memory', content_rowid='rowid');

      -- Triggers to sync FTS
      CREATE TRIGGER IF NOT EXISTS memory_ai AFTER INSERT ON long_term_memory BEGIN
        INSERT INTO memory_fts(rowid, summary) VALUES (new.rowid, new.summary);
      END;
      CREATE TRIGGER IF NOT EXISTS memory_ad AFTER DELETE ON long_term_memory BEGIN
        INSERT INTO memory_fts(memory_fts, rowid, summary) VALUES('delete', old.rowid, old.summary);
      END;
      CREATE TRIGGER IF NOT EXISTS memory_au AFTER UPDATE ON long_term_memory BEGIN
        INSERT INTO memory_fts(memory_fts, rowid, summary) VALUES('delete', old.rowid, old.summary);
        INSERT INTO memory_fts(rowid, summary) VALUES (new.rowid, new.summary);
      END;
    `);
  }

  public async save(record: Omit<IMemoryRecord, 'id' | 'created_at' | 'updated_at' | 'access_count' | 'version' | 'archived'>): Promise<IMemoryRecord> {
    if (!this.db) this.initialize();

    const now = new Date().toISOString();
    const fullRecord: IMemoryRecord = {
      id: randomUUID(),
      ...record,
      created_at: new Date(now),
      updated_at: new Date(now),
      access_count: 0,
      version: 1,
      archived: false
    };

    const stmt = this.db!.prepare(`
      INSERT INTO long_term_memory (
        id, category, importance, summary, details, hash, source, 
        created_at, updated_at, last_accessed_at, access_count, version, archived
      ) VALUES (
        @id, @category, @importance, @summary, @details, @hash, @source,
        @created_at, @updated_at, @last_accessed_at, @access_count, @version, @archived
      )
      ON CONFLICT(hash) DO UPDATE SET
        importance = excluded.importance,
        access_count = long_term_memory.access_count + 1,
        last_accessed_at = excluded.updated_at,
        updated_at = excluded.updated_at,
        details = excluded.details
    `);

    // SQLite expects 0/1 for boolean and NULL for undefined
    const params = {
      ...fullRecord,
      details: fullRecord.details || null,
      source: fullRecord.source || null,
      created_at: now,
      updated_at: now,
      last_accessed_at: now, // Set accessing time on save/update
      archived: 0
    };

    stmt.run(params);
    return fullRecord;
  }

  public findByHash(hash: string): IMemoryRecord | null {
    if (!this.db) this.initialize();
    
    const row = this.db!.prepare('SELECT * FROM long_term_memory WHERE hash = ?').get(hash) as any;
    return row ? this.mapRowToRecord(row) : null;
  }

  public search(query: string, limit: number = 5): IMemoryRecord[] {
    if (!this.db) this.initialize();

    // Sanitize query for FTS5: remove characters that break FTS5 syntax
    // Keep only alphanumeric, spaces, and safe punctuation (comma, period, hyphen)
    // const safeQuery = query.replace(/[^a-zA-Z0-9\s,.\-]/g, "").trim();
    
    // if (!safeQuery) {
    //     console.warn('[SatiRepository] Empty query after sanitization');
    //     return this.getFallbackMemories(limit);
    // }

    // try {
    //     // Try FTS5 search first
    //     const stmt = this.db!.prepare(`
    //         SELECT m.* 
    //         FROM long_term_memory m
    //         JOIN memory_fts f ON m.rowid = f.rowid
    //         WHERE memory_fts MATCH ? AND m.archived = 0
    //         ORDER BY rank
    //         LIMIT ?
    //     `);
        
    //     const rows = stmt.all(safeQuery, limit) as any[];
        
    //     if (rows.length > 0) {
    //         console.log(`[SatiRepository] FTS5 found ${rows.length} memories for: "${safeQuery}"`);
    //         return rows.map(this.mapRowToRecord);
    //     }
        
    //     // Fallback: try LIKE search
    //     console.log(`[SatiRepository] FTS5 returned no results, trying LIKE search for: "${safeQuery}"`);
    //     const likeStmt = this.db!.prepare(`
    //         SELECT * FROM long_term_memory
    //         WHERE (summary LIKE ? OR details LIKE ?) 
    //         AND archived = 0
    //         ORDER BY importance DESC, access_count DESC
    //         LIMIT ?
    //     `);
        
    //     const likePattern = `%${safeQuery}%`;
    //     const likeRows = likeStmt.all(likePattern, likePattern, limit) as any[];
        
    //     if (likeRows.length > 0) {
    //         console.log(`[SatiRepository] LIKE search found ${likeRows.length} memories`);
    //         return likeRows.map(this.mapRowToRecord);
    //     }
        
    //     // Final fallback: return most important/accessed memories
    //     console.log('[SatiRepository] No search results, returning most important memories');
    //     return this.getFallbackMemories(limit);

    // } catch (e) {
    //     console.warn(`[SatiRepository] Search failed for query "${query}": ${e}`);
    //     return this.getFallbackMemories(limit);
    // }
        return this.getFallbackMemories(limit);
  }

  private getFallbackMemories(limit: number): IMemoryRecord[] {
    if (!this.db) return [];
    
    const stmt = this.db.prepare(`
        SELECT * FROM long_term_memory
        WHERE archived = 0
        ORDER BY 
            CASE importance
                WHEN 'critical' THEN 1
                WHEN 'high' THEN 2
                WHEN 'medium' THEN 3
                WHEN 'low' THEN 4
            END,
            access_count DESC,
            created_at DESC
        LIMIT ?
    `);
    
    const rows = stmt.all(limit) as any[];
    return rows.map(this.mapRowToRecord);
  }

  public getAllMemories(): IMemoryRecord[] {
     if (!this.db) this.initialize();
     const rows = this.db!.prepare('SELECT * FROM long_term_memory WHERE archived = 0 ORDER BY created_at DESC').all() as any[];
     return rows.map(this.mapRowToRecord);
  }

  private mapRowToRecord(row: any): IMemoryRecord {
    return {
      id: row.id,
      category: row.category as MemoryCategory,
      importance: row.importance as MemoryImportance,
      summary: row.summary,
      details: row.details,
      hash: row.hash,
      source: row.source,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      last_accessed_at: row.last_accessed_at ? new Date(row.last_accessed_at) : undefined,
      access_count: row.access_count,
      version: row.version,
      archived: Boolean(row.archived)
    };
  }

  public close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
