import Database from 'better-sqlite3';
import path from 'path';
import { homedir } from 'os';
import fs from 'fs-extra';
import { randomUUID, createHash } from 'crypto';
import loadVecExtension from '../memory/sqlite-vec.js';
import { DisplayManager } from '../display.js';
import type { PaginatedResponse } from '../../types/pagination.js';

export type DocumentStatus = 'pending' | 'indexing' | 'indexed' | 'error';

export interface LinkDocument {
  id: string;
  filename: string;
  filepath: string;
  file_hash: string;
  file_size: number;
  mime_type: string | null;
  status: DocumentStatus;
  chunk_count: number;
  error_message: string | null;
  created_at: number;
  updated_at: number;
  indexed_at: number | null;
}

export interface LinkChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  char_start: number;
  char_end: number;
  created_at: number;
}

export interface SearchResult {
  chunk: LinkChunk;
  document: LinkDocument;
  score: number;
  vectorScore: number;
  bm25Score: number;
}

export interface DocumentFilters {
  status?: DocumentStatus;
  search?: string;
  page?: number;
  per_page?: number;
}

const EMBEDDING_DIM = 384;

export class LinkRepository {
  private static instance: LinkRepository | null = null;
  private db: Database.Database | null = null;
  private dbPath: string;
  private display = DisplayManager.getInstance();

  private constructor(dbPath?: string) {
    this.dbPath = dbPath || path.join(homedir(), '.morpheus', 'memory', 'sati-memory.db');
  }

  public static getInstance(dbPath?: string): LinkRepository {
    if (!LinkRepository.instance) {
      LinkRepository.instance = new LinkRepository(dbPath);
    }
    return LinkRepository.instance;
  }

  public initialize(): void {
    fs.ensureDirSync(path.dirname(this.dbPath));

    this.db = new Database(this.dbPath, { timeout: 5000 });
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    loadVecExtension(this.db);

    this.createSchema();
  }

  private createSchema(): void {
    if (!this.db) throw new Error('DB not initialized');

    this.db.exec(`
      -- Documents table
      CREATE TABLE IF NOT EXISTS link_documents (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        filepath TEXT NOT NULL UNIQUE,
        file_hash TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        chunk_count INTEGER DEFAULT 0,
        error_message TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        indexed_at INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_link_docs_status ON link_documents(status);
      CREATE INDEX IF NOT EXISTS idx_link_docs_hash ON link_documents(file_hash);
      CREATE INDEX IF NOT EXISTS idx_link_docs_filepath ON link_documents(filepath);

      -- Chunks table
      CREATE TABLE IF NOT EXISTS link_chunks (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        char_start INTEGER NOT NULL,
        char_end INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (document_id) REFERENCES link_documents(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_link_chunks_doc ON link_chunks(document_id);

      -- Vector table (vec0)
      CREATE VIRTUAL TABLE IF NOT EXISTS link_chunk_vec USING vec0(
        embedding float[${EMBEDDING_DIM}]
      );

      -- Embedding mapping table
      CREATE TABLE IF NOT EXISTS link_chunk_embedding_map (
        chunk_id TEXT PRIMARY KEY,
        vec_rowid INTEGER NOT NULL,
        FOREIGN KEY (chunk_id) REFERENCES link_chunks(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_link_chunk_vec_map ON link_chunk_embedding_map(vec_rowid);

      -- FTS5 for BM25
      CREATE VIRTUAL TABLE IF NOT EXISTS link_chunk_fts USING fts5(
        content,
        content='link_chunks',
        content_rowid='rowid',
        tokenize='unicode61 remove_diacritics 2'
      );

      -- FTS triggers
      CREATE TRIGGER IF NOT EXISTS link_chunk_ai AFTER INSERT ON link_chunks BEGIN
        INSERT INTO link_chunk_fts(rowid, content) VALUES (new.rowid, new.content);
      END;

      CREATE TRIGGER IF NOT EXISTS link_chunk_ad AFTER DELETE ON link_chunks BEGIN
        INSERT INTO link_chunk_fts(link_chunk_fts, rowid, content) VALUES('delete', old.rowid, old.content);
      END;
    `);
  }

  public saveDocument(doc: Omit<LinkDocument, 'id' | 'created_at' | 'updated_at'> & { id?: string }): LinkDocument {
    if (!this.db) this.initialize();

    const now = Date.now();
    const id = doc.id || randomUUID();

    const fullDoc: LinkDocument = {
      id,
      filename: doc.filename,
      filepath: doc.filepath,
      file_hash: doc.file_hash,
      file_size: doc.file_size,
      mime_type: doc.mime_type,
      status: doc.status,
      chunk_count: doc.chunk_count || 0,
      error_message: doc.error_message,
      created_at: now,
      updated_at: now,
      indexed_at: doc.indexed_at,
    };

    this.db!.prepare(`
      INSERT INTO link_documents (
        id, filename, filepath, file_hash, file_size, mime_type,
        status, chunk_count, error_message, created_at, updated_at, indexed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(filepath) DO UPDATE SET
        file_hash = excluded.file_hash,
        file_size = excluded.file_size,
        mime_type = excluded.mime_type,
        status = excluded.status,
        error_message = excluded.error_message,
        updated_at = excluded.updated_at
    `).run(
      fullDoc.id,
      fullDoc.filename,
      fullDoc.filepath,
      fullDoc.file_hash,
      fullDoc.file_size,
      fullDoc.mime_type,
      fullDoc.status,
      fullDoc.chunk_count,
      fullDoc.error_message,
      fullDoc.created_at,
      fullDoc.updated_at,
      fullDoc.indexed_at
    );

    return fullDoc;
  }

  public updateDocumentStatus(id: string, status: DocumentStatus, errorMessage?: string): LinkDocument | null {
    if (!this.db) this.initialize();

    const now = Date.now();
    const indexedAt = status === 'indexed' ? now : undefined;

    this.db!.prepare(`
      UPDATE link_documents
      SET status = ?, error_message = ?, updated_at = ?, indexed_at = COALESCE(?, indexed_at)
      WHERE id = ?
    `).run(status, errorMessage ?? null, now, indexedAt ?? null, id);

    return this.getDocument(id);
  }

  public updateDocumentChunkCount(id: string, chunkCount: number): void {
    if (!this.db) this.initialize();

    this.db!.prepare(`
      UPDATE link_documents
      SET chunk_count = ?, updated_at = ?
      WHERE id = ?
    `).run(chunkCount, Date.now(), id);
  }

  public deleteDocument(id: string): boolean {
    if (!this.db) this.initialize();

    const result = this.db!.prepare('DELETE FROM link_documents WHERE id = ?').run(id);
    return result.changes > 0;
  }

  public getDocument(id: string): LinkDocument | null {
    if (!this.db) this.initialize();

    const row = this.db!.prepare('SELECT * FROM link_documents WHERE id = ?').get(id) as any;
    return row ? this.mapRowToDocument(row) : null;
  }

  public findByHash(hash: string): LinkDocument | null {
    if (!this.db) this.initialize();

    const row = this.db!.prepare('SELECT * FROM link_documents WHERE file_hash = ?').get(hash) as any;
    return row ? this.mapRowToDocument(row) : null;
  }

  public findByPath(filepath: string): LinkDocument | null {
    if (!this.db) this.initialize();

    const row = this.db!.prepare('SELECT * FROM link_documents WHERE filepath = ?').get(filepath) as any;
    return row ? this.mapRowToDocument(row) : null;
  }

  public listDocuments(filters?: DocumentFilters): PaginatedResponse<LinkDocument> {
    if (!this.db) this.initialize();

    const page = Math.max(1, filters?.page ?? 1);
    const per_page = Math.min(100, Math.max(1, filters?.per_page ?? 20));
    const offset = (page - 1) * per_page;

    const params: any[] = [];
    let whereClause = 'WHERE 1=1';

    if (filters?.status) {
      whereClause += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters?.search) {
      whereClause += ' AND (filename LIKE ? OR filepath LIKE ?)';
      const pattern = `%${filters.search}%`;
      params.push(pattern, pattern);
    }

    const total = (this.db!.prepare(`SELECT COUNT(*) as cnt FROM link_documents ${whereClause}`).get(...params) as { cnt: number }).cnt;

    const rows = this.db!.prepare(`
      SELECT * FROM link_documents ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, per_page, offset) as any[];

    return {
      data: rows.map(r => this.mapRowToDocument(r)),
      total,
      page,
      per_page,
      total_pages: Math.ceil(total / per_page),
    };
  }

  public getAllDocumentPaths(): string[] {
    if (!this.db) this.initialize();

    const rows = this.db!.prepare('SELECT filepath FROM link_documents').all() as any[];
    return rows.map(r => r.filepath);
  }

  public saveChunk(chunk: Omit<LinkChunk, 'id' | 'created_at'> & { id?: string }): LinkChunk {
    if (!this.db) this.initialize();

    const now = Date.now();
    const id = chunk.id || randomUUID();

    this.db!.prepare(`
      INSERT INTO link_chunks (id, document_id, chunk_index, content, char_start, char_end, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, chunk.document_id, chunk.chunk_index, chunk.content, chunk.char_start, chunk.char_end, now);

    return {
      id,
      document_id: chunk.document_id,
      chunk_index: chunk.chunk_index,
      content: chunk.content,
      char_start: chunk.char_start,
      char_end: chunk.char_end,
      created_at: now,
    };
  }

  public saveEmbedding(chunkId: string, embedding: number[]): void {
    if (!this.db) this.initialize();

    const getExisting = this.db!.prepare(`
      SELECT vec_rowid FROM link_chunk_embedding_map WHERE chunk_id = ?
    `);

    const insertVec = this.db!.prepare(`
      INSERT INTO link_chunk_vec (embedding) VALUES (?)
    `);

    const deleteVec = this.db!.prepare(`
      DELETE FROM link_chunk_vec WHERE rowid = ?
    `);

    const upsertMap = this.db!.prepare(`
      INSERT OR REPLACE INTO link_chunk_embedding_map (chunk_id, vec_rowid) VALUES (?, ?)
    `);

    const transaction = this.db!.transaction(() => {
      const existing = getExisting.get(chunkId) as any;

      if (existing?.vec_rowid) {
        deleteVec.run(existing.vec_rowid);
      }

      const result = insertVec.run(new Float32Array(embedding));
      const newVecRowId = result.lastInsertRowid as number;

      upsertMap.run(chunkId, newVecRowId);
    });

    transaction();
  }

  public searchHybrid(
    query: string,
    queryEmbedding: number[],
    limit: number = 5,
    scoreThreshold: number = 0.7,
    vectorWeight: number = 0.8,
    bm25Weight: number = 0.2
  ): SearchResult[] {
    if (!this.db) this.initialize();

    // Vector search
    const vectorResults = this.searchByVector(queryEmbedding, limit * 2);

    // BM25 search
    const bm25Results = this.searchByBM25(query, limit * 2);

    // Combine results using weighted scores
    const scores = new Map<string, { vector: number; bm25: number; chunk: LinkChunk | null; document: LinkDocument | null }>();

    // Normalize vector scores (already 0-1 from cosine similarity)
    for (const vr of vectorResults) {
      scores.set(vr.chunk.id, {
        vector: vr.score,
        bm25: 0,
        chunk: vr.chunk,
        document: vr.document,
      });
    }

    // Normalize BM25 scores
    const maxBm25 = Math.max(...bm25Results.map(r => r.score), 1);
    for (const br of bm25Results) {
      const existing = scores.get(br.chunk.id);
      const normalizedBm25 = br.score / maxBm25;
      if (existing) {
        existing.bm25 = normalizedBm25;
      } else {
        scores.set(br.chunk.id, {
          vector: 0,
          bm25: normalizedBm25,
          chunk: br.chunk,
          document: br.document,
        });
      }
    }

    // Calculate combined scores
    const results: SearchResult[] = [];
    for (const [chunkId, data] of scores) {
      if (!data.chunk || !data.document) continue;

      const combinedScore = (data.vector * vectorWeight) + (data.bm25 * bm25Weight);

      if (combinedScore >= scoreThreshold) {
        results.push({
          chunk: data.chunk,
          document: data.document,
          score: combinedScore,
          vectorScore: data.vector,
          bm25Score: data.bm25,
        });
      }
    }

    // Sort by combined score descending
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit);
  }

  private searchByVector(embedding: number[], limit: number): Array<{ chunk: LinkChunk; document: LinkDocument; score: number }> {
    if (!this.db) return [];

    const stmt = this.db.prepare(`
      SELECT
        c.id as chunk_id,
        c.document_id,
        c.chunk_index,
        c.content,
        c.char_start,
        c.char_end,
        c.created_at as chunk_created_at,
        d.id as doc_id,
        d.filename,
        d.filepath,
        d.file_hash,
        d.file_size,
        d.mime_type,
        d.status,
        d.chunk_count,
        d.error_message,
        d.created_at as doc_created_at,
        d.updated_at,
        d.indexed_at,
        (1 - vec_distance_cosine(v.embedding, ?)) as similarity
      FROM link_chunk_vec v
      JOIN link_chunk_embedding_map map ON map.vec_rowid = v.rowid
      JOIN link_chunks c ON c.id = map.chunk_id
      JOIN link_documents d ON d.id = c.document_id
      WHERE d.status = 'indexed'
      ORDER BY similarity DESC
      LIMIT ?
    `);

    const rows = stmt.all(new Float32Array(embedding), limit) as any[];

    return rows.map(r => ({
      chunk: {
        id: r.chunk_id,
        document_id: r.document_id,
        chunk_index: r.chunk_index,
        content: r.content,
        char_start: r.char_start,
        char_end: r.char_end,
        created_at: r.chunk_created_at,
      },
      document: {
        id: r.doc_id,
        filename: r.filename,
        filepath: r.filepath,
        file_hash: r.file_hash,
        file_size: r.file_size,
        mime_type: r.mime_type,
        status: r.status,
        chunk_count: r.chunk_count,
        error_message: r.error_message,
        created_at: r.doc_created_at,
        updated_at: r.updated_at,
        indexed_at: r.indexed_at,
      },
      score: r.similarity,
    }));
  }

  private searchByBM25(query: string, limit: number): Array<{ chunk: LinkChunk; document: LinkDocument; score: number }> {
    if (!this.db) return [];

    // Sanitize query for FTS5
    const safeQuery = query
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!safeQuery) return [];

    const stmt = this.db.prepare(`
      SELECT
        c.id as chunk_id,
        c.document_id,
        c.chunk_index,
        c.content,
        c.char_start,
        c.char_end,
        c.created_at as chunk_created_at,
        d.id as doc_id,
        d.filename,
        d.filepath,
        d.file_hash,
        d.file_size,
        d.mime_type,
        d.status,
        d.chunk_count,
        d.error_message,
        d.created_at as doc_created_at,
        d.updated_at,
        d.indexed_at,
        bm25(link_chunk_fts) as rank
      FROM link_chunks c
      JOIN link_chunk_fts ON c.rowid = link_chunk_fts.rowid
      JOIN link_documents d ON d.id = c.document_id
      WHERE link_chunk_fts MATCH ? AND d.status = 'indexed'
      ORDER BY rank ASC
      LIMIT ?
    `);

    const rows = stmt.all(safeQuery, limit) as any[];

    // Convert rank to score (lower rank = higher score)
    const maxRank = Math.max(...rows.map(r => Math.abs(r.rank)), 1);

    return rows.map(r => ({
      chunk: {
        id: r.chunk_id,
        document_id: r.document_id,
        chunk_index: r.chunk_index,
        content: r.content,
        char_start: r.char_start,
        char_end: r.char_end,
        created_at: r.chunk_created_at,
      },
      document: {
        id: r.doc_id,
        filename: r.filename,
        filepath: r.filepath,
        file_hash: r.file_hash,
        file_size: r.file_size,
        mime_type: r.mime_type,
        status: r.status,
        chunk_count: r.chunk_count,
        error_message: r.error_message,
        created_at: r.doc_created_at,
        updated_at: r.updated_at,
        indexed_at: r.indexed_at,
      },
      score: 1 - (Math.abs(r.rank) / maxRank),
    }));
  }

  public getStats(): { totalDocuments: number; indexedDocuments: number; totalChunks: number; pendingDocuments: number; errorDocuments: number } {
    if (!this.db) this.initialize();

    const totalDocs = (this.db!.prepare('SELECT COUNT(*) as cnt FROM link_documents').get() as { cnt: number }).cnt;
    const indexedDocs = (this.db!.prepare("SELECT COUNT(*) as cnt FROM link_documents WHERE status = 'indexed'").get() as { cnt: number }).cnt;
    const pendingDocs = (this.db!.prepare("SELECT COUNT(*) as cnt FROM link_documents WHERE status = 'pending' OR status = 'indexing'").get() as { cnt: number }).cnt;
    const errorDocs = (this.db!.prepare("SELECT COUNT(*) as cnt FROM link_documents WHERE status = 'error'").get() as { cnt: number }).cnt;
    const totalChunks = (this.db!.prepare('SELECT COUNT(*) as cnt FROM link_chunks').get() as { cnt: number }).cnt;

    return {
      totalDocuments: totalDocs,
      indexedDocuments: indexedDocs,
      totalChunks,
      pendingDocuments: pendingDocs,
      errorDocuments: errorDocs,
    };
  }

  public deleteChunksByDocument(documentId: string): void {
    if (!this.db) this.initialize();

    // Get chunk IDs to delete embeddings
    const chunks = this.db!.prepare('SELECT id FROM link_chunks WHERE document_id = ?').all(documentId) as any[];

    for (const chunk of chunks) {
      this.deleteEmbedding(chunk.id);
    }

    // Delete chunks (cascades to FTS via trigger)
    this.db!.prepare('DELETE FROM link_chunks WHERE document_id = ?').run(documentId);
  }

  private deleteEmbedding(chunkId: string): void {
    if (!this.db) return;

    const getExisting = this.db.prepare(`
      SELECT vec_rowid FROM link_chunk_embedding_map WHERE chunk_id = ?
    `);

    const deleteVec = this.db.prepare(`
      DELETE FROM link_chunk_vec WHERE rowid = ?
    `);

    const deleteMap = this.db.prepare(`
      DELETE FROM link_chunk_embedding_map WHERE chunk_id = ?
    `);

    const existing = getExisting.get(chunkId) as any;
    if (existing?.vec_rowid) {
      deleteVec.run(existing.vec_rowid);
    }
    deleteMap.run(chunkId);
  }

  private mapRowToDocument(row: any): LinkDocument {
    return {
      id: row.id,
      filename: row.filename,
      filepath: row.filepath,
      file_hash: row.file_hash,
      file_size: row.file_size,
      mime_type: row.mime_type,
      status: row.status,
      chunk_count: row.chunk_count || 0,
      error_message: row.error_message,
      created_at: row.created_at,
      updated_at: row.updated_at,
      indexed_at: row.indexed_at,
    };
  }

  public close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
