import Database from 'better-sqlite3';
import path from 'path';
import { homedir } from 'os';
import fs from 'fs-extra';
import { randomUUID } from 'crypto';
import { IMemoryRecord, MemoryCategory, MemoryImportance } from './types.js';
import loadVecExtension from '../sqlite-vec.js';

const EMBEDDING_DIM = 384;

export class SatiRepository {
  private db: Database.Database | null = null;
  private dbPath: string;
  private static instance: SatiRepository;

  private constructor(dbPath?: string) {
    this.dbPath =
      dbPath || path.join(homedir(), '.morpheus', 'memory', 'santi-memory.db');
  }

  public static getInstance(dbPath?: string): SatiRepository {
    if (!SatiRepository.instance) {
      SatiRepository.instance = new SatiRepository(dbPath);
    }
    return SatiRepository.instance;
  }

  public initialize(): void {
    fs.ensureDirSync(path.dirname(this.dbPath));

    this.db = new Database(this.dbPath, { timeout: 5000 });
    this.db.pragma('journal_mode = WAL');

    loadVecExtension(this.db);

    this.createSchema();
  }

  private createSchema() {
    if (!this.db) throw new Error('DB not initialized');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory_embedding_map (
        memory_id TEXT PRIMARY KEY,
        vec_rowid INTEGER NOT NULL
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS memory_vec USING vec0(
        embedding float[${EMBEDDING_DIM}]
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
        summary,
        details,
        content='long_term_memory',
        content_rowid='rowid'
      );

      INSERT INTO memory_fts(memory_fts) VALUES('rebuild');

      CREATE TRIGGER IF NOT EXISTS memory_ai AFTER INSERT ON long_term_memory BEGIN
        INSERT INTO memory_fts(rowid, summary, details)
        VALUES (new.rowid, new.summary, new.details);
      END;

      CREATE TRIGGER IF NOT EXISTS memory_ad AFTER DELETE ON long_term_memory BEGIN
        INSERT INTO memory_fts(memory_fts, rowid, summary, details)
        VALUES('delete', old.rowid, old.summary, old.details);
      END;

      CREATE TRIGGER IF NOT EXISTS memory_au AFTER UPDATE ON long_term_memory BEGIN
        INSERT INTO memory_fts(memory_fts, rowid, summary, details)
        VALUES('delete', old.rowid, old.summary, old.details);

        INSERT INTO memory_fts(rowid, summary, details)
        VALUES (new.rowid, new.summary, new.details);
      END;
    `);
  }

  // 🔥 NOVO — Salvar embedding
  public upsertEmbedding(memoryId: string, embedding: number[]) {
    if (!this.db) this.initialize();

    const vecInsert = this.db!.prepare(`
      INSERT INTO memory_vec (embedding)
      VALUES (?)
    `);

    const result = vecInsert.run(new Float32Array(embedding));
    const vecRowId = result.lastInsertRowid as number;

    this.db!.prepare(`
      INSERT OR REPLACE INTO memory_embedding_map (memory_id, vec_rowid)
      VALUES (?, ?)
    `).run(memoryId, vecRowId);
  }

  // 🔥 NOVO — Busca vetorial
  private searchByVector(embedding: number[], limit: number): IMemoryRecord[] {
    if (!this.db) return [];

    const stmt = this.db.prepare(`
      SELECT m.*, 
        vec_distance_cosine(v.embedding, ?) as distance
      FROM memory_vec v
      JOIN memory_embedding_map map ON map.vec_rowid = v.rowid
      JOIN long_term_memory m ON m.id = map.memory_id
      WHERE m.archived = 0
      ORDER BY distance ASC
      LIMIT ?
    `);

    const rows = stmt.all(new Float32Array(embedding), limit) as any[];
    return rows.map(this.mapRowToRecord);
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
  // 🔥 ATUALIZADO
  public search(
    query: string,
    limit: number = 5,
    embedding?: number[]
  ): IMemoryRecord[] {
    if (!this.db) this.initialize();

    try {
      // 1️⃣ Vetorial (se embedding foi passado)
      if (embedding) {
        const vectorResults = this.searchByVector(embedding, limit);
        if (vectorResults.length > 0) {
          console.log('[SatiRepository] Vector search hit');
          return vectorResults;
        }
      }

      // 2️⃣ FTS
      const safeQuery = query
        .replace(/[^a-zA-Z0-9\s,.\-]/g, '')
        .trim();

      if (safeQuery) {
        const stmt = this.db!.prepare(`
          SELECT m.*, bm25(memory_fts) as rank
          FROM long_term_memory m
          JOIN memory_fts ON m.rowid = memory_fts.rowid
          WHERE memory_fts MATCH ?
          AND m.archived = 0
          ORDER BY rank
          LIMIT ?
        `);

        const rows = stmt.all(safeQuery, limit) as any[];
        if (rows.length > 0) return rows.map(this.mapRowToRecord);
      }

      // 3️⃣ LIKE fallback
      const likeStmt = this.db!.prepare(`
        SELECT * FROM long_term_memory
        WHERE (summary LIKE ? OR details LIKE ?) 
        AND archived = 0
        ORDER BY importance DESC, access_count DESC
        LIMIT ?
      `);

      const pattern = `%${query}%`;
      const likeRows = likeStmt.all(pattern, pattern, limit) as any[];

      if (likeRows.length > 0)
        return likeRows.map(this.mapRowToRecord);

      // 4️⃣ Final fallback
      return this.getFallbackMemories(limit);
    } catch (e) {
      console.warn(`[SatiRepository] Search error: ${e}`);
      return this.getFallbackMemories(limit);
    }
  }

  private getFallbackMemories(limit: number): IMemoryRecord[] {
    if (!this.db) return [];

    const rows = this.db
      .prepare(`
        SELECT * FROM long_term_memory
        WHERE archived = 0
        ORDER BY access_count DESC, created_at DESC
        LIMIT ?
      `)
      .all(limit) as any[];

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
      category: row.category,
      importance: row.importance,
      summary: row.summary,
      details: row.details,
      hash: row.hash,
      source: row.source,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      last_accessed_at: row.last_accessed_at
        ? new Date(row.last_accessed_at)
        : undefined,
      access_count: row.access_count,
      version: row.version,
      archived: Boolean(row.archived)
    };
  }

  public archiveMemory(id: string): boolean {
    if (!this.db) this.initialize();

    const stmt = this.db!.prepare('UPDATE long_term_memory SET archived = 1 WHERE id = ?');
    const result = stmt.run(id);

    return result.changes > 0;
  }

  public close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
