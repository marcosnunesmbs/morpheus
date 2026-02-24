import Database from 'better-sqlite3';
import path from 'path';
import { homedir } from 'os';
import fs from 'fs-extra';
import { randomUUID } from 'crypto';
import { IMemoryRecord, MemoryCategory, MemoryImportance } from './types.js';
import loadVecExtension from '../sqlite-vec.js';
import { DisplayManager } from '../../display.js';

const EMBEDDING_DIM = 384;

export class SatiRepository {
  private db: Database.Database | null = null;
  private dbPath: string;
  private static instance: SatiRepository;
  private display = DisplayManager.getInstance();

  private constructor(dbPath?: string) {
    this.dbPath =
      dbPath || path.join(homedir(), '.morpheus', 'memory', 'sati-memory.db');
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
    -- ===============================
    -- 1️⃣ TABELA PRINCIPAL
    -- ===============================
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

    CREATE INDEX IF NOT EXISTS idx_memory_category 
      ON long_term_memory(category);

    CREATE INDEX IF NOT EXISTS idx_memory_importance 
      ON long_term_memory(importance);

    CREATE INDEX IF NOT EXISTS idx_memory_archived 
      ON long_term_memory(archived);

    -- ===============================
    -- 2️⃣ FTS5
    -- ===============================
    CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
      summary,
      details,
      content='long_term_memory',
      content_rowid='rowid',
      tokenize = 'unicode61 remove_diacritics 2'
    );

    -- ===============================
    -- 3️⃣ VECTOR TABLE (vec0)
    -- ===============================
    CREATE VIRTUAL TABLE IF NOT EXISTS memory_vec USING vec0(
      embedding float[${EMBEDDING_DIM}]
    );

    CREATE TABLE IF NOT EXISTS memory_embedding_map (
      memory_id TEXT PRIMARY KEY,
      vec_rowid INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_embedding_map_vec_rowid
    ON memory_embedding_map(vec_rowid);

    -- ===============================
    -- 4️⃣ TRIGGERS FTS
    -- ===============================
    CREATE TRIGGER IF NOT EXISTS memory_ai 
    AFTER INSERT ON long_term_memory BEGIN
      INSERT INTO memory_fts(rowid, summary, details)
      VALUES (new.rowid, new.summary, new.details);
    END;

    CREATE TRIGGER IF NOT EXISTS memory_ad 
    AFTER DELETE ON long_term_memory BEGIN
      INSERT INTO memory_fts(memory_fts, rowid, summary, details)
      VALUES('delete', old.rowid, old.summary, old.details);
    END;

    CREATE TRIGGER IF NOT EXISTS memory_au 
    AFTER UPDATE ON long_term_memory BEGIN
      INSERT INTO memory_fts(memory_fts, rowid, summary, details)
      VALUES('delete', old.rowid, old.summary, old.details);

      INSERT INTO memory_fts(rowid, summary, details)
      VALUES (new.rowid, new.summary, new.details);
    END;

    -- ===============================
    -- 3️⃣ VECTOR TABLE SESSIONS (vec0)
    -- ===============================

    CREATE TABLE IF NOT EXISTS session_chunks (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );


    CREATE VIRTUAL TABLE IF NOT EXISTS session_vec USING vec0(
      embedding float[384]
    );

    CREATE TABLE IF NOT EXISTS session_embedding_map (
      session_chunk_id TEXT PRIMARY KEY,
      vec_rowid INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_session_embedding_map_vec_rowid
    ON session_embedding_map(vec_rowid);

  `);
  }


  // 🔥 NOVO — Salvar embedding
  public upsertEmbedding(memoryId: string, embedding: number[]) {
    if (!this.db) this.initialize();

    const getExisting = this.db!.prepare(`
    SELECT vec_rowid FROM memory_embedding_map
    WHERE memory_id = ?
  `);

    const insertVec = this.db!.prepare(`
    INSERT INTO memory_vec (embedding)
    VALUES (?)
  `);

    const deleteVec = this.db!.prepare(`
    DELETE FROM memory_vec WHERE rowid = ?
  `);

    const upsertMap = this.db!.prepare(`
    INSERT OR REPLACE INTO memory_embedding_map (memory_id, vec_rowid)
    VALUES (?, ?)
  `);

    const transaction = this.db!.transaction(() => {
      const existing = getExisting.get(memoryId) as any;

      if (existing?.vec_rowid) {
        deleteVec.run(existing.vec_rowid);
      }

      const result = insertVec.run(new Float32Array(embedding));
      const newVecRowId = result.lastInsertRowid as number;

      upsertMap.run(memoryId, newVecRowId);
    });

    transaction();
  }


  // 🔥 NOVO — Busca vetorial
  // private searchByVector(
  //   embedding: number[],
  //   limit: number
  // ): IMemoryRecord[] {
  //   if (!this.db) return [];

  //   const SIMILARITY_THRESHOLD = 0.5; // ajuste fino depois

  //   const stmt = this.db.prepare(`
  //   SELECT 
  //     m.*,
  //     vec_distance_cosine(v.embedding, ?) as distance
  //   FROM memory_vec v
  //   JOIN memory_embedding_map map ON map.vec_rowid = v.rowid
  //   JOIN long_term_memory m ON m.id = map.memory_id
  //   WHERE m.archived = 0
  //   ORDER BY distance ASC
  //   LIMIT ?
  // `);

  //   const rows = stmt.all(
  //     new Float32Array(embedding),
  //     limit
  //   ) as any[];

  //   // 🔥 Filtrar por similaridade real
  //   const ranked = rows
  //     .map(r => ({
  //       ...r,
  //       similarity: 1 - r.distance
  //     }));

  //   const filtered = ranked
  //     .filter(r => r.distance >= SIMILARITY_THRESHOLD)
  //     .sort((a, b) => b.similarity - a.similarity);

  //   if (filtered.length > 0) {
  //     console.log(
  //       `[SatiRepository] Vector hit (${filtered.length})`
  //     );
  //   }

  //   return filtered.map(this.mapRowToRecord);
  // }

  private searchUnifiedVector(
    embedding: number[],
    limit: number
  ): IMemoryRecord[] {
    if (!this.db) return [];

    const SIMILARITY_THRESHOLD = 0.9;

    const stmt = this.db.prepare(`
    SELECT *
    FROM (
      -- LONG TERM MEMORY
      SELECT 
        m.id as id,
        m.summary as summary,
        m.details as details,
        m.category as category,
        m.importance as importance,
        'long_term' as source_type,
        (1 - vec_distance_cosine(v.embedding, ?)) * 0.8 as distance
      FROM memory_vec v
      JOIN memory_embedding_map map ON map.vec_rowid = v.rowid
      JOIN long_term_memory m ON m.id = map.memory_id
      WHERE m.archived = 0

      UNION ALL

      -- SESSION CHUNKS
      SELECT 
        sc.id as id,
        sc.content as summary,
        sc.content as details,
        'session' as category,
        'medium' as importance,
        'session_chunk' as source_type,
        (1 - vec_distance_cosine(v.embedding, ?)) * 0.2 as distance
      FROM session_vec v
      JOIN session_embedding_map map ON map.vec_rowid = v.rowid
      JOIN session_chunks sc ON sc.id = map.session_chunk_id
    )
    ORDER BY distance ASC
    LIMIT ?
  `);

    const rows = stmt.all(
      new Float32Array(embedding),
      new Float32Array(embedding),
      limit
    ) as any[];

    // console.log(
    //   `[SatiRepository] Unified vector search returned ${rows.length} raw results`
    // );
    // console each row
    // rows.forEach((row, index) => {
    //   console.log(`[SatiRepository] Row ${index + 1}:`, row);
    // });

    // Note: the SQL query already computes distance as (1 - cosine_distance) * weight,
    // so higher values mean higher similarity. Use distance directly as similarity score.
    const ranked = rows
      .map(r => ({
        ...r,
        similarity: 1 - r.distance
      }))
      .sort((a, b) => b.similarity - a.similarity);

    const filtered = ranked
      .filter(r => r.similarity >= SIMILARITY_THRESHOLD)
      .sort((a, b) => b.similarity - a.similarity);

    this.display.log(
      `🧠 Unified vector search retornou ${filtered.length} resultados`,
      { source: 'Sati', level: 'debug' }
    );


    return filtered.map(r => ({
      id: r.id,
      summary: r.summary,
      details: r.details,
      category: r.category,
      importance: r.importance,
      hash: '',
      source: r.source_type,
      created_at: new Date(),
      updated_at: new Date(),
      access_count: 0,
      version: 1,
      archived: false
    }));
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

  public search(
    query: string,
    limit: number = 5,
    embedding?: number[]
  ): IMemoryRecord[] {
    if (!this.db) this.initialize();

    try {
      this.display.log(
        `🔍 Iniciando busca de memória | Query: "${query}"`,
        { source: 'Sati', level: 'debug' }
      );

      // 1️⃣ Vetorial
      if (embedding && embedding.length > 0) {
        this.display.log(
          '🧠  Tentando busca vetorial...',
          { source: 'Sati', level: 'debug' }
        );

        const vectorResults = this.searchUnifiedVector(embedding, limit);

        if (vectorResults.length > 0) {
          this.display.log(
            `✅  Vetorial retornou ${vectorResults.length} resultado(s)`,
            { source: 'Sati', level: 'success' }
          );

          return vectorResults.slice(0, limit);
        }

        this.display.log(
          '⚠️  Vetorial não encontrou resultados relevantes',
          { source: 'Sati', level: 'debug' }
        );
      } else {
        this.display.log(
          '🛡️  Disabled Archived Sessions in Memory Retrieval',
          { source: 'Sati', level: 'info' }
        );
      }

      // 2️⃣ BM25 (FTS)
      // Sanitize query: remove characters that could break FTS5 syntax (like ?, *, OR, etc)
      // keeping only letters, numbers and spaces.
      const safeQuery = query
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (safeQuery) {
        this.display.log(
          '📚  Tentando busca BM25 (FTS5)...',
          { source: 'Sati', level: 'debug' }
        );

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

        if (rows.length > 0) {
          this.display.log(
            `✅  BM25 retornou ${rows.length} resultado(s)`,
            { source: 'Sati', level: 'success' }
          );
          return rows.map(this.mapRowToRecord);
        }

        this.display.log(
          '⚠️  BM25 não encontrou resultados',
          { source: 'Sati', level: 'debug' }
        );
      }

      // 3️⃣ LIKE fallback
      this.display.log(
        '🧵  Tentando fallback LIKE...',
        { source: 'Sati', level: 'debug' }
      );

      const likeStmt = this.db!.prepare(`
      SELECT * FROM long_term_memory
      WHERE (summary LIKE ? OR details LIKE ?) 
      AND archived = 0
      ORDER BY importance DESC, access_count DESC
      LIMIT ?
    `);

      const pattern = `%${query}%`;
      const likeRows = likeStmt.all(pattern, pattern, limit) as any[];

      if (likeRows.length > 0) {
        this.display.log(
          `✅  LIKE retornou ${likeRows.length} resultado(s)`,
          { source: 'Sati', level: 'success' }
        );
        return likeRows.map(this.mapRowToRecord);
      }

      // 4️⃣ Final fallback
      this.display.log(
        '🛟  Nenhum mecanismo encontrou resultados. Usando fallback estratégico.',
        { source: 'Sati', level: 'warning' }
      );

      return this.getFallbackMemories(limit);

    } catch (e) {
      this.display.log(
        `❌  Erro durante busca: ${e}`,
        { source: 'Sati', level: 'error' }
      );

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

  public update(
    id: string,
    data: Partial<Pick<IMemoryRecord, 'summary' | 'details' | 'importance' | 'category'>>
  ): IMemoryRecord | null {
    if (!this.db) this.initialize();

    const existing = this.db!.prepare('SELECT * FROM long_term_memory WHERE id = ?').get(id) as any;
    if (!existing) return null;

    const setClauses: string[] = ['updated_at = @updated_at', 'version = version + 1'];
    const params: Record<string, any> = { id, updated_at: new Date().toISOString() };

    if (data.importance !== undefined) {
      setClauses.push('importance = @importance');
      params.importance = data.importance;
    }
    if (data.category !== undefined) {
      setClauses.push('category = @category');
      params.category = data.category;
    }
    if (data.summary !== undefined) {
      setClauses.push('summary = @summary');
      params.summary = data.summary;
    }
    if (data.details !== undefined) {
      setClauses.push('details = @details');
      params.details = data.details;
    }

    this.db!.prepare(
      `UPDATE long_term_memory SET ${setClauses.join(', ')} WHERE id = @id`
    ).run(params);

    const updated = this.db!.prepare('SELECT * FROM long_term_memory WHERE id = ?').get(id) as any;
    return updated ? this.mapRowToRecord(updated) : null;
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
