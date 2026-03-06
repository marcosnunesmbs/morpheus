import { homedir } from 'os';
import path from 'path';
import fs from 'fs-extra';
import fsSync from 'fs';
import { LinkRepository } from './link-repository.js';
import { LinkSearch } from './link-search.js';
import { hashFile, processDocument, isSupportedFormat } from './link-chunker.js';
import { EmbeddingService } from './memory/embedding.service.js';
import { ConfigManager } from '../config/manager.js';
import { DisplayManager } from './display.js';

/**
 * LinkWorker - Background worker for document indexing
 *
 * Scans ~/.morpheus/docs folder, processes new/changed documents,
 * generates embeddings, and removes deleted documents from the index.
 */
export class LinkWorker {
  private static instance: LinkWorker | null = null;

  private repository: LinkRepository;
  private search: LinkSearch;
  private embeddingService: EmbeddingService | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private display = DisplayManager.getInstance();

  private docsPath: string;

  private constructor() {
    this.repository = LinkRepository.getInstance();
    this.search = LinkSearch.getInstance();
    this.docsPath = path.join(homedir(), '.morpheus', 'docs');
  }

  public static getInstance(): LinkWorker {
    if (!LinkWorker.instance) {
      LinkWorker.instance = new LinkWorker();
    }
    return LinkWorker.instance;
  }

  public static setInstance(instance: LinkWorker): void {
    LinkWorker.instance = instance;
  }

  public static resetInstance(): void {
    if (LinkWorker.instance) {
      LinkWorker.instance.stop();
    }
    LinkWorker.instance = null;
  }

  /**
   * Start the background worker with interval-based scanning.
   */
  start(): void {
    if (this.isRunning) return;

    const config = ConfigManager.getInstance().getLinkConfig();
    const intervalMs = config.scan_interval_ms;

    this.isRunning = true;
    this.display.log('LinkWorker started', { source: 'Link' });

    // Run initial scan immediately
    this.tick().catch(err => {
      this.display.log(`LinkWorker initial scan failed: ${(err as Error).message}`, { source: 'Link', level: 'error' });
    });

    // Schedule periodic scans
    this.intervalId = setInterval(() => {
      this.tick().catch(err => {
        this.display.log(`LinkWorker tick failed: ${(err as Error).message}`, { source: 'Link', level: 'error' });
      });
    }, intervalMs);
  }

  /**
   * Stop the background worker.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    this.display.log('LinkWorker stopped', { source: 'Link' });
  }

  /**
   * Update the scan interval (hot-reload).
   */
  updateInterval(intervalMs: number): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = setInterval(() => {
        this.tick().catch(err => {
          this.display.log(`LinkWorker tick failed: ${(err as Error).message}`, { source: 'Link', level: 'error' });
        });
      }, intervalMs);
      this.display.log(`LinkWorker interval updated to ${intervalMs}ms`, { source: 'Link' });
    }
  }

  /**
   * Perform a single scan cycle.
   */
  async tick(): Promise<{
    indexed: number;
    removed: number;
    errors: number;
  }> {
    // Ensure embedding service is initialized
    if (!this.embeddingService) {
      this.embeddingService = await EmbeddingService.getInstance();
    }

    // Ensure docs folder exists
    await fs.ensureDir(this.docsPath);

    const stats = {
      indexed: 0,
      removed: 0,
      errors: 0,
    };

    try {
      // Scan for new/changed documents
      const files = await this.scanFolder();
      this.display.log(`LinkWorker found ${files.length} files`, { source: 'Link', level: 'debug' });

      // Process each file
      for (const filePath of files) {
        try {
          const result = await this.processDocument(filePath);
          if (result === 'indexed') {
            stats.indexed++;
          } else if (result === 'error') {
            stats.errors++;
          }
        } catch (err) {
          this.display.log(`Failed to process ${filePath}: ${(err as Error).message}`, { source: 'Link', level: 'error' });
          stats.errors++;
        }
      }

      // Remove deleted documents
      stats.removed = await this.removeDeletedDocuments(files);

      if (stats.indexed > 0 || stats.removed > 0) {
        this.display.log(
          `LinkWorker: indexed ${stats.indexed}, removed ${stats.removed}, errors ${stats.errors}`,
          { source: 'Link', level: 'info' }
        );
      }
    } catch (err) {
      this.display.log(`LinkWorker tick error: ${(err as Error).message}`, { source: 'Link', level: 'error' });
      stats.errors++;
    }

    return stats;
  }

  /**
   * Scan the docs folder for supported files.
   */
  async scanFolder(): Promise<string[]> {
    const files: string[] = [];

    const entries = await fs.readdir(this.docsPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile()) {
        const filePath = path.join(this.docsPath, entry.name);
        if (isSupportedFormat(filePath)) {
          files.push(filePath);
        }
      }
    }

    return files;
  }

  /**
   * Validate file integrity by checking magic bytes.
   */
  async validateFileIntegrity(filePath: string): Promise<{ valid: boolean; error?: string }> {
    const ext = path.extname(filePath).toLowerCase();
    
    try {
      // Read first 8 bytes using synchronous fs (fs-extra doesn't support position option)
      const buffer = Buffer.alloc(8);
      const fd = fsSync.openSync(filePath, 'r');
      fsSync.readSync(fd, buffer, 0, 8, 0);
      fsSync.closeSync(fd);
      
      if (buffer.length === 0) {
        return { valid: false, error: 'Empty file' };
      }

      // Check magic bytes based on file type
      if (ext === '.pdf') {
        // PDF magic bytes: %PDF (25 50 44 46)
        if (buffer[0] !== 0x25 || buffer[1] !== 0x50 || buffer[2] !== 0x44 || buffer[3] !== 0x46) {
          return { valid: false, error: 'Invalid PDF file: missing magic bytes' };
        }
      } else if (ext === '.docx') {
        // DOCX is a ZIP file, check PK (50 4B)
        if (buffer[0] !== 0x50 || buffer[1] !== 0x4B) {
          return { valid: false, error: 'Invalid DOCX file: missing ZIP magic bytes' };
        }
      } else if (ext === '.txt' || ext === '.md') {
        // Text files - just check it's readable (first bytes should be valid UTF-8)
        // Allow any bytes for text files, just check not empty
        if (buffer.length === 0) {
          return { valid: false, error: 'Empty file' };
        }
      }

      return { valid: true };
    } catch (err) {
      return { valid: false, error: `Failed to read file: ${(err as Error).message}` };
    }
  }

  /**
   * Process a single document: check hash, parse, chunk, embed.
   */
  async processDocument(filePath: string): Promise<'indexed' | 'skipped' | 'error'> {
    const existingDoc = this.repository.getDocumentByPath(filePath);

    // Validate file integrity first
    const integrity = await this.validateFileIntegrity(filePath);
    if (!integrity.valid) {
      if (existingDoc) {
        this.repository.updateDocumentStatus(existingDoc.id, 'error', integrity.error);
      }
      return 'error';
    }

    // Calculate file hash
    let fileHash: string;
    try {
      fileHash = await hashFile(filePath);
    } catch (err) {
      // File might not be readable
      if (existingDoc) {
        this.repository.updateDocumentStatus(existingDoc.id, 'error', `Failed to read file: ${(err as Error).message}`);
      }
      return 'error';
    }

    // Check if document already indexed with same hash
    if (existingDoc && existingDoc.file_hash === fileHash && existingDoc.status === 'indexed') {
      return 'skipped';
    }

    // Get file stats
    const stats = await fs.stat(filePath);
    const fileSize = stats.size;

    // Check max file size
    const config = ConfigManager.getInstance().getLinkConfig();
    const maxSizeBytes = config.max_file_size_mb * 1024 * 1024;
    if (fileSize > maxSizeBytes) {
      if (existingDoc) {
        this.repository.updateDocumentStatus(existingDoc.id, 'error', `File exceeds max size of ${config.max_file_size_mb}MB`);
      }
      return 'error';
    }

    // Create or update document record
    const filename = path.basename(filePath);
    let document: ReturnType<typeof this.repository.createDocument>;

    if (existingDoc) {
      // Update existing document - delete old chunks first
      this.repository.deleteChunksByDocument(existingDoc.id);
      this.repository.deleteEmbeddingsByDocument(existingDoc.id);
      this.repository.updateDocumentStatus(existingDoc.id, 'indexing');
      document = existingDoc;
    } else {
      // Create new document
      document = this.repository.createDocument({
        filename,
        file_path: filePath,
        file_hash: fileHash,
        file_size: fileSize,
      });
    }

    try {
      // Index the document
      await this.indexDocument(document.id, filePath, fileHash);

      // Update status to indexed
      const chunks = this.repository.getChunksByDocument(document.id);
      this.repository.updateDocumentChunkCount(document.id, chunks.length);

      this.display.log(`Indexed document: ${filename} (${chunks.length} chunks)`, { source: 'Link', level: 'debug' });
      return 'indexed';
    } catch (err) {
      this.repository.updateDocumentStatus(document.id, 'error', (err as Error).message);
      return 'error';
    }
  }

  /**
   * Index a document: parse, chunk, generate embeddings.
   */
  async indexDocument(documentId: string, filePath: string, fileHash: string): Promise<void> {
    const config = ConfigManager.getInstance().getLinkConfig();
    const chunkSize = config.chunk_size;

    // Parse and chunk the document
    const processed = await processDocument(filePath, chunkSize);

    // Verify hash matches (file might have changed during processing)
    if (processed.hash !== fileHash) {
      throw new Error('File changed during processing - hash mismatch');
    }

    // Create chunks in database
    const chunkInputs = processed.chunks.map(chunk => ({
      document_id: documentId,
      position: chunk.position,
      content: chunk.content,
      char_start: chunk.char_start,
      char_end: chunk.char_end,
    }));

    this.repository.createChunks(chunkInputs);

    // Get the created chunks with IDs
    const chunks = this.repository.getChunksByDocument(documentId);

    // Generate embeddings for each chunk
    await this.generateEmbeddings(chunks);
  }

  /**
   * Generate embeddings for chunks using Sati's EmbeddingService.
   */
  async generateEmbeddings(chunks: { id: string; content: string }[]): Promise<void> {
    if (!this.embeddingService) {
      this.embeddingService = await EmbeddingService.getInstance();
    }

    const embeddings: { chunk_id: string; embedding: number[] }[] = [];

    // Process in batches to avoid memory issues
    const batchSize = 50;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);

      const batchEmbeddings = await Promise.all(
        batch.map(async chunk => {
          const embedding = await this.embeddingService!.generate(chunk.content);
          return { chunk_id: chunk.id, embedding };
        })
      );

      embeddings.push(...batchEmbeddings);
    }

    // Store embeddings in database
    this.repository.createEmbeddings(embeddings);
  }

  /**
   * Remove documents that no longer exist in the docs folder.
   */
  async removeDeletedDocuments(existingFiles: string[]): Promise<number> {
    const existingPaths = new Set(existingFiles);
    const documents = this.repository.listDocuments();

    let removed = 0;
    for (const doc of documents) {
      if (!existingPaths.has(doc.file_path)) {
        // Document file no longer exists - remove from index
        this.repository.deleteDocument(doc.id);
        removed++;
        this.display.log(`Removed deleted document: ${doc.filename}`, { source: 'Link', level: 'debug' });
      }
    }

    return removed;
  }
}