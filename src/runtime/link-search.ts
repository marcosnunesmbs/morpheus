import Database from 'better-sqlite3';
import { LinkRepository } from './link-repository.js';
import { ConfigManager } from '../config/manager.js';
import { EmbeddingService } from './memory/embedding.service.js';

/**
 * LinkSearch - Hybrid search for Link documents
 *
 * Combines vector similarity search (80% weight) with BM25 text search (20% weight)
 * for optimal retrieval of relevant document chunks.
 */
export class LinkSearch {
  private static instance: LinkSearch | null = null;

  private repository: LinkRepository;
  private db: Database.Database | null = null;
  private embeddingService: EmbeddingService | null = null;

  private constructor() {
    this.repository = LinkRepository.getInstance();
  }

  public static getInstance(): LinkSearch {
    if (!LinkSearch.instance) {
      LinkSearch.instance = new LinkSearch();
    }
    return LinkSearch.instance;
  }

  public static resetInstance(): void {
    LinkSearch.instance = null;
  }

  public async initialize(): Promise<void> {
    // Get the database from the repository
    this.db = (this.repository as any).db as Database.Database;
    // Initialize embedding service
    this.embeddingService = await EmbeddingService.getInstance();
  }

  /**
   * Perform vector similarity search using sqlite-vec.
   */
  vectorSearch(queryEmbedding: number[], limit: number): Array<{
    chunk_id: string;
    document_id: string;
    filename: string;
    position: number;
    content: string;
    score: number;
  }> {
    if (!this.db) {
      throw new Error('LinkSearch not initialized');
    }

    const embeddingBlob = new Float32Array(queryEmbedding);

    // Query vector similarity using cosine distance
    const rows = this.db.prepare(`
      SELECT
        e.chunk_id,
        c.document_id,
        d.filename,
        c.position,
        c.content,
        vec_distance_cosine(e.embedding, ?) as distance
      FROM embeddings e
      JOIN chunks c ON e.chunk_id = c.id
      JOIN documents d ON c.document_id = d.id
      WHERE d.status = 'indexed'
      ORDER BY distance ASC
      LIMIT ?
    `).all(embeddingBlob, limit) as any[];

    // Convert distance to similarity score (1 - distance for cosine)
    return rows.map(row => ({
      chunk_id: row.chunk_id,
      document_id: row.document_id,
      filename: row.filename,
      position: row.position,
      content: row.content,
      score: 1 - row.distance,
    }));
  }

  /**
   * Perform BM25 full-text search using FTS5.
   */
  bm25Search(query: string, limit: number): Array<{
    chunk_id: string;
    document_id: string;
    filename: string;
    position: number;
    content: string;
    score: number;
  }> {
    if (!this.db) {
      throw new Error('LinkSearch not initialized');
    }

    // Sanitize query: remove characters that could break FTS5 syntax (like ?, *, OR, etc)
    // keeping only letters, numbers and spaces.
    const escapedQuery = query
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Return empty results if query is empty after sanitization
    if (!escapedQuery) {
      return [];
    }

    const rows = this.db.prepare(`
      SELECT
        c.id as chunk_id,
        c.document_id,
        d.filename,
        c.position,
        c.content,
        bm25(chunks_fts) as bm25_score
      FROM chunks_fts fts
      JOIN chunks c ON c.rowid = fts.rowid
      JOIN documents d ON c.document_id = d.id
      WHERE d.status = 'indexed'
        AND chunks_fts MATCH ?
      ORDER BY bm25_score ASC
      LIMIT ?
    `).all(escapedQuery, limit) as any[];

    // BM25 returns negative scores for better matches, negate and normalize
    return rows.map(row => ({
      chunk_id: row.chunk_id,
      document_id: row.document_id,
      filename: row.filename,
      position: row.position,
      content: row.content,
      score: -row.bm25_score, // Negate since BM25 returns negative for better matches
    }));
  }

  /**
   * Normalize scores to 0-1 range using min-max scaling.
   */
  normalizeScores<T extends { score: number }>(results: T[]): T[] {
    if (results.length === 0) return results;

    const scores = results.map(r => r.score);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const range = max - min;

    if (range === 0) {
      // All scores are the same
      return results.map(r => ({ ...r, score: 1 }));
    }

    return results.map(r => ({
      ...r,
      score: (r.score - min) / range,
    }));
  }

  /**
   * Perform hybrid search combining vector and BM25 results.
   */
  hybridSearch(
    queryEmbedding: number[],
    queryText: string,
    limit: number,
    threshold: number
  ): Array<{
    chunk_id: string;
    document_id: string;
    filename: string;
    position: number;
    content: string;
    score: number;
    vector_score: number;
    bm25_score: number;
  }> {
    const config = ConfigManager.getInstance().getLinkConfig();
    const vectorWeight = config.vector_weight;
    const bm25Weight = config.bm25_weight;

    // Get results from both methods (fetch more for better merging)
    const fetchLimit = limit * 3;

    const vectorResults = this.vectorSearch(queryEmbedding, fetchLimit);
    const bm25Results = this.bm25Search(queryText, fetchLimit);

    // Normalize scores
    const normalizedVector = this.normalizeScores(vectorResults);
    const normalizedBM25 = this.normalizeScores(bm25Results);

    // Create maps for quick lookup
    const vectorMap = new Map(normalizedVector.map(r => [r.chunk_id, r]));
    const bm25Map = new Map(normalizedBM25.map(r => [r.chunk_id, r]));

    // Combine all unique chunk IDs
    const allChunkIds = new Set([...vectorMap.keys(), ...bm25Map.keys()]);

    // Calculate combined scores
    const combined: Array<{
      chunk_id: string;
      document_id: string;
      filename: string;
      position: number;
      content: string;
      score: number;
      vector_score: number;
      bm25_score: number;
    }> = [];

    for (const chunkId of allChunkIds) {
      const vResult = vectorMap.get(chunkId);
      const bResult = bm25Map.get(chunkId);

      const vectorScore = vResult?.score ?? 0;
      const bm25Score = bResult?.score ?? 0;

      // Weighted combination
      const combinedScore = (vectorScore * vectorWeight) + (bm25Score * bm25Weight);

      // Get the data from whichever result has it
      const data = vResult || bResult;
      if (!data) continue;

      combined.push({
        chunk_id: chunkId,
        document_id: data.document_id,
        filename: data.filename,
        position: data.position,
        content: data.content,
        score: combinedScore,
        vector_score: vectorScore,
        bm25_score: bm25Score,
      });
    }

    // Sort by combined score and filter by threshold
    const filtered = combined
      .filter(r => r.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return filtered;
  }

  /**
   * Search with a text query (generates embedding internally).
   */
  async search(
    queryText: string,
    limit?: number,
    threshold?: number
  ): Promise<Array<{
    chunk_id: string;
    document_id: string;
    filename: string;
    position: number;
    content: string;
    score: number;
    vector_score: number;
    bm25_score: number;
  }>> {
    if (!this.embeddingService) {
      throw new Error('LinkSearch not initialized');
    }

    const config = ConfigManager.getInstance().getLinkConfig();
    const maxResults = limit ?? config.max_results;
    const minThreshold = threshold ?? config.score_threshold;

    // Generate embedding for the query
    const queryEmbedding = await this.embeddingService.generate(queryText);

    return this.hybridSearch(queryEmbedding, queryText, maxResults, minThreshold);
  }
}