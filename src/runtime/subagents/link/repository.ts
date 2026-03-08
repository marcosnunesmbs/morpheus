import Database from 'better-sqlite3';
import fs from 'fs-extra';
import path from 'path';
import { randomUUID } from 'crypto';
import loadVecExtension from '../../memory/sqlite-vec.js';
import { DisplayManager } from '../../display.js';
import { PATHS } from '../../../config/paths.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export type DocumentStatus = 'pending' | 'indexing' | 'indexed' | 'error';

export interface Document {
  id: string;
  filename: string;
  file_path: string;
  file_hash: string;
  file_size: number;
  status: DocumentStatus;
  error_message: string | null;
  chunk_count: number;
  created_at: string;
  updated_at: string;
}

export interface Chunk {
  id: string;
  document_id: string;
  position: number;
  content: string;
  char_start: number;
  char_end: number;
  created_at: string;
}

export interface SearchResult {
  chunk_id: string;
  content: string;
  document_id: string;
  filename: string;
  position: number;
  score: number;
  vector_score: number;
  bm25_score: number;
}

export interface CreateDocumentInput {
  filename: string;
  file_path: string;
  file_hash: string;
  file_size: number;
}

export interface CreateChunkInput {
  document_id: string;
  position: number;
  content: string;
  char_start: number;
  char_end: number;
}

// ─── Repository ──────────────────────────────────────────────────────────────

const EMBEDDING_DIM = 384;

export class LinkRepository {
  private static instance: LinkRepository | null = null;
  private db: Database.Database | null = null;
  private dbPath: string;
  private display = DisplayManager.getInstance();

  private constructor(dbPath?: string) {
    this.dbPath = dbPath || PATHS.linkDb;
  }

  public static getInstance(dbPath?: string): LinkRepository {
    if (!LinkRepository.instance) {
      LinkRepository.instance = new LinkRepository(dbPath);
    }
    return LinkRepository.instance;
  }

  public static resetInstance(): void {
    if (LinkRepository.instance?.db) {
      LinkRepository.instance.db.close();
    }
    LinkRepository.instance = null;
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

    // Documents table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        file_path TEXT NOT NULL UNIQUE,
        file_hash TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        error_message TEXT,
        chunk_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // Chunks table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        content TEXT NOT NULL,
        char_start INTEGER NOT NULL,
        char_end INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(document_id, position),
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
      );
    `);

    // Embeddings table (sqlite-vec)
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS embeddings USING vec0(
        chunk_id TEXT PRIMARY KEY,
        embedding FLOAT[${EMBEDDING_DIM}]
      );
    `);

    // FTS5 virtual table for BM25 search
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
        content,
        content='chunks',
        content_rowid='rowid',
        tokenize='porter unicode61'
      );
    `);

    // Indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
      CREATE INDEX IF NOT EXISTS idx_documents_hash ON documents(file_hash);
      CREATE INDEX IF NOT EXISTS idx_chunks_document ON chunks(document_id);
    `);

    // Triggers to keep FTS in sync
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
        INSERT INTO chunks_fts(rowid, content) VALUES (NEW.rowid, NEW.content);
      END;

      CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
        INSERT INTO chunks_fts(chunks_fts, rowid, content) VALUES('delete', OLD.rowid, OLD.content);
      END;

      CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
        INSERT INTO chunks_fts(chunks_fts, rowid, content) VALUES('delete', OLD.rowid, OLD.content);
        INSERT INTO chunks_fts(rowid, content) VALUES (NEW.rowid, NEW.content);
      END;
    `);
  }

  // ─── Document CRUD ────────────────────────────────────────────────────────

  createDocument(input: CreateDocumentInput): Document {
    if (!this.db) throw new Error('DB not initialized');

    const now = new Date().toISOString();
    const id = randomUUID();

    this.db.prepare(`
      INSERT INTO documents (id, filename, file_path, file_hash, file_size, status, error_message, chunk_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'pending', NULL, 0, ?, ?)
    `).run(id, input.filename, input.file_path, input.file_hash, input.file_size, now, now);

    return this.getDocument(id)!;
  }

  getDocument(id: string): Document | null {
    if (!this.db) throw new Error('DB not initialized');

    const row = this.db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as any;
    return row ? this.deserializeDocument(row) : null;
  }

  getDocumentByPath(file_path: string): Document | null {
    if (!this.db) throw new Error('DB not initialized');

    const row = this.db.prepare('SELECT * FROM documents WHERE file_path = ?').get(file_path) as any;
    return row ? this.deserializeDocument(row) : null;
  }

  getDocumentByHash(hash: string): Document | null {
    if (!this.db) throw new Error('DB not initialized');

    const row = this.db.prepare('SELECT * FROM documents WHERE file_hash = ?').get(hash) as any;
    return row ? this.deserializeDocument(row) : null;
  }

  listDocuments(status?: DocumentStatus): Document[] {
    if (!this.db) throw new Error('DB not initialized');

    let query = 'SELECT * FROM documents';
    const params: any[] = [];

    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY updated_at DESC';

    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map((r) => this.deserializeDocument(r));
  }

  updateDocumentStatus(id: string, status: DocumentStatus, error_message?: string | null): Document | null {
    if (!this.db) throw new Error('DB not initialized');

    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE documents SET status = ?, error_message = ?, updated_at = ? WHERE id = ?
    `).run(status, error_message ?? null, now, id);

    return this.getDocument(id);
  }

  updateDocumentChunkCount(id: string, chunk_count: number): void {
    if (!this.db) throw new Error('DB not initialized');

    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE documents SET chunk_count = ?, status = 'indexed', updated_at = ? WHERE id = ?
    `).run(chunk_count, now, id);
  }

  deleteDocument(id: string): boolean {
    if (!this.db) throw new Error('DB not initialized');

    // CASCADE will delete chunks and embeddings automatically
    const result = this.db.prepare('DELETE FROM documents WHERE id = ?').run(id);
    return result.changes > 0;
  }

  deleteDocumentByPath(file_path: string): boolean {
    if (!this.db) throw new Error('DB not initialized');

    const result = this.db.prepare('DELETE FROM documents WHERE file_path = ?').run(file_path);
    return result.changes > 0;
  }

  // ─── Chunk CRUD ───────────────────────────────────────────────────────────

  createChunk(input: CreateChunkInput): Chunk {
    if (!this.db) throw new Error('DB not initialized');

    const now = new Date().toISOString();
    const id = randomUUID();

    this.db.prepare(`
      INSERT INTO chunks (id, document_id, position, content, char_start, char_end, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, input.document_id, input.position, input.content, input.char_start, input.char_end, now);

    return this.getChunk(id)!;
  }

  createChunks(inputs: CreateChunkInput[]): void {
    if (!this.db) throw new Error('DB not initialized');

    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO chunks (id, document_id, position, content, char_start, char_end, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = this.db.transaction((items: CreateChunkInput[]) => {
      for (const input of items) {
        stmt.run(randomUUID(), input.document_id, input.position, input.content, input.char_start, input.char_end, now);
      }
    });

    insertMany(inputs);
  }

  getChunk(id: string): Chunk | null {
    if (!this.db) throw new Error('DB not initialized');

    const row = this.db.prepare('SELECT * FROM chunks WHERE id = ?').get(id) as any;
    return row ? this.deserializeChunk(row) : null;
  }

  getChunksByDocument(document_id: string): Chunk[] {
    if (!this.db) throw new Error('DB not initialized');

    const rows = this.db.prepare('SELECT * FROM chunks WHERE document_id = ? ORDER BY position').all(document_id) as any[];
    return rows.map((r) => this.deserializeChunk(r));
  }

  deleteChunksByDocument(document_id: string): void {
    if (!this.db) throw new Error('DB not initialized');

    this.db.prepare('DELETE FROM chunks WHERE document_id = ?').run(document_id);
  }

  // ─── Embeddings ───────────────────────────────────────────────────────────

  createEmbedding(chunk_id: string, embedding: number[]): void {
    if (!this.db) throw new Error('DB not initialized');

    const embeddingBlob = new Float32Array(embedding);
    this.db.prepare(`
      INSERT INTO embeddings (chunk_id, embedding) VALUES (?, ?)
    `).run(chunk_id, embeddingBlob);
  }

  createEmbeddings(items: { chunk_id: string; embedding: number[] }[]): void {
    if (!this.db) throw new Error('DB not initialized');

    const stmt = this.db.prepare(`
      INSERT INTO embeddings (chunk_id, embedding) VALUES (?, ?)
    `);

    const insertMany = this.db.transaction((items: { chunk_id: string; embedding: number[] }[]) => {
      for (const item of items) {
        const embeddingBlob = new Float32Array(item.embedding);
        stmt.run(item.chunk_id, embeddingBlob);
      }
    });

    insertMany(items);
  }

  deleteEmbeddingsByDocument(document_id: string): void {
    if (!this.db) throw new Error('DB not initialized');

    // Get all chunk IDs for this document
    const chunks = this.db.prepare('SELECT id FROM chunks WHERE document_id = ?').all(document_id) as any[];
    const chunkIds = chunks.map(c => c.id);

    if (chunkIds.length === 0) return;

    const placeholders = chunkIds.map(() => '?').join(',');
    this.db.prepare(`DELETE FROM embeddings WHERE chunk_id IN (${placeholders})`).run(...chunkIds);
  }

  // ─── Stats ─────────────────────────────────────────────────────────────────

  getStats(): { documents_total: number; documents_indexed: number; chunks_total: number } {
    if (!this.db) throw new Error('DB not initialized');

    const documents_total = (this.db.prepare('SELECT COUNT(*) as cnt FROM documents').get() as any).cnt as number;
    const documents_indexed = (this.db.prepare("SELECT COUNT(*) as cnt FROM documents WHERE status = 'indexed'").get() as any).cnt as number;
    const chunks_total = (this.db.prepare('SELECT COUNT(*) as cnt FROM chunks').get() as any).cnt as number;

    return { documents_total, documents_indexed, chunks_total };
  }

  // ─── Cleanup ───────────────────────────────────────────────────────────────

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // ─── Deserializers ─────────────────────────────────────────────────────────

  private deserializeDocument(row: any): Document {
    return {
      id: row.id,
      filename: row.filename,
      file_path: row.file_path,
      file_hash: row.file_hash,
      file_size: row.file_size,
      status: row.status as DocumentStatus,
      error_message: row.error_message ?? null,
      chunk_count: row.chunk_count ?? 0,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private deserializeChunk(row: any): Chunk {
    return {
      id: row.id,
      document_id: row.document_id,
      position: row.position,
      content: row.content,
      char_start: row.char_start,
      char_end: row.char_end,
      created_at: row.created_at,
    };
  }
}