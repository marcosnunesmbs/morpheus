import fs from 'fs-extra';
import path from 'path';
import { createHash } from 'crypto';
import { LinkRepository, type LinkDocument, type DocumentStatus } from './repository.js';
import { DisplayManager } from '../display.js';
import { ConfigManager } from '../../config/manager.js';
import { PATHS } from '../../config/paths.js';
import { AuditRepository } from '../audit/repository.js';

// Text extraction libraries (loaded dynamically)
let pdfParse: any;
let mammoth: any;

export class LinkWorker {
  private static instance: LinkWorker | null = null;
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private repository: LinkRepository;
  private display = DisplayManager.getInstance();
  private scanIntervalMs: number;

  constructor(repository?: LinkRepository) {
    this.repository = repository || LinkRepository.getInstance();
    this.scanIntervalMs = ConfigManager.getInstance().getLinkConfig().scan_interval_ms || 60000;
  }

  static getInstance(): LinkWorker | null {
    return LinkWorker.instance;
  }

  static setInstance(worker: LinkWorker): void {
    LinkWorker.instance = worker;
  }

  public start(): void {
    if (this.timer) return;

    this.display.log(`Link Worker started (interval: ${this.scanIntervalMs}ms)`, { source: 'Link' });

    // Run initial scan
    void this.tick();

    // Schedule periodic scans
    this.timer = setInterval(() => void this.tick(), this.scanIntervalMs);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.display.log('Link Worker stopped', { source: 'Link' });
  }

  public updateInterval(newMs: number): void {
    if (newMs < 5000) return;
    this.scanIntervalMs = newMs;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = setInterval(() => void this.tick(), this.scanIntervalMs);
    }
    this.display.log(`Link Worker interval updated to ${newMs}ms`, { source: 'Link' });
  }

  private async tick(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      await this.scanDocuments();
      await this.cleanupDeletedFiles();
    } catch (err: any) {
      this.display.log(`Link Worker error: ${err.message}`, { source: 'Link', level: 'error' });
    } finally {
      this.isRunning = false;
    }
  }

  private async scanDocuments(): Promise<void> {
    const config = ConfigManager.getInstance().getLinkConfig();
    const docsDir = PATHS.docs;

    // Ensure docs directory exists
    await fs.ensureDir(docsDir);

    // Get all files in docs directory recursively
    const files = await this.getAllFiles(docsDir);

    this.display.log(`Scanning ${files.length} files in docs directory`, { source: 'Link', level: 'debug' });

    for (const filepath of files) {
      try {
        await this.processDocument(filepath, config);
      } catch (err: any) {
        this.display.log(`Failed to process ${filepath}: ${err.message}`, { source: 'Link', level: 'error' });
      }
    }
  }

  private async getAllFiles(dir: string): Promise<string[]> {
    const config = ConfigManager.getInstance().getLinkConfig();
    const allowedExtensions = config.allowed_extensions || ['.txt', '.md', '.pdf', '.docx'];
    const files: string[] = [];

    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const subFiles = await this.getAllFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (allowedExtensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }

    return files;
  }

  private async processDocument(filepath: string, config: ReturnType<typeof ConfigManager.prototype.getLinkConfig>): Promise<void> {
    const stats = await fs.stat(filepath);
    const maxSizeBytes = (config.max_file_size_mb || 50) * 1024 * 1024;

    // Check file size
    if (stats.size > maxSizeBytes) {
      this.display.log(`Skipping ${filepath}: file too large (${stats.size} bytes)`, { source: 'Link', level: 'warning' });
      return;
    }

    // Calculate file hash
    const content = await fs.readFile(filepath);
    const fileHash = createHash('sha256').update(content).digest('hex');

    // Check if document already exists and hasn't changed
    const existingDoc = this.repository.findByPath(filepath);
    if (existingDoc && existingDoc.file_hash === fileHash) {
      // File hasn't changed, skip
      return;
    }

    // Check if hash exists (file moved)
    const hashMatch = this.repository.findByHash(fileHash);
    if (hashMatch && hashMatch.filepath !== filepath) {
      // File was moved, update path
      this.repository.saveDocument({
        ...hashMatch,
        filepath,
        filename: path.basename(filepath),
      });
      return;
    }

    // New or changed file - index it
    const docId = existingDoc?.id || crypto.randomUUID();
    const filename = path.basename(filepath);
    const mimeType = this.getMimeType(filepath);

    // Save/update document record
    this.repository.saveDocument({
      id: docId,
      filename,
      filepath,
      file_hash: fileHash,
      file_size: stats.size,
      mime_type: mimeType,
      status: 'indexing',
      chunk_count: 0,
      error_message: null,
      indexed_at: null,
    });

    this.display.log(`Indexing ${filepath}...`, { source: 'Link' });

    try {
      // Extract text
      const text = await this.extractText(filepath, content);

      if (!text || text.trim().length === 0) {
        this.repository.updateDocumentStatus(docId, 'error', 'No text content extracted');
        return;
      }

      // Chunk text
      const chunks = this.chunkText(text, config.chunk_size || 500);

      // Delete old chunks if re-indexing
      if (existingDoc) {
        this.repository.deleteChunksByDocument(docId);
      }

      // Save chunks
      let chunkIndex = 0;
      for (const chunk of chunks) {
        const chunkId = crypto.randomUUID();
        this.repository.saveChunk({
          id: chunkId,
          document_id: docId,
          chunk_index: chunkIndex,
          content: chunk.text,
          char_start: chunk.start,
          char_end: chunk.end,
        });
        chunkIndex++;
      }

      // Update document status
      this.repository.updateDocumentStatus(docId, 'indexed');
      this.repository.updateDocumentChunkCount(docId, chunks.length);

      this.display.log(`Indexed ${filepath}: ${chunks.length} chunks`, { source: 'Link', level: 'success' });

      // Emit audit event
      AuditRepository.getInstance().insert({
        session_id: 'link-system',
        event_type: 'link_index',
        agent: 'link',
        status: 'success',
        metadata: { document_id: docId, filename, chunks: chunks.length },
      });

    } catch (err: any) {
      this.repository.updateDocumentStatus(docId, 'error', err.message);

      AuditRepository.getInstance().insert({
        session_id: 'link-system',
        event_type: 'link_index',
        agent: 'link',
        status: 'error',
        metadata: { document_id: docId, filename, error: err.message },
      });

      throw err;
    }
  }

  private async extractText(filepath: string, content: Buffer): Promise<string> {
    const ext = path.extname(filepath).toLowerCase();

    switch (ext) {
      case '.txt':
      case '.md':
      case '.json':
      case '.csv':
      case '.ts':
      case '.js':
      case '.py':
      case '.java':
      case '.cpp':
      case '.c':
      case '.h':
      case '.hpp':
      case '.html':
      case '.css':
      case '.xml':
      case '.yaml':
      case '.yml':
        // Text files - read as UTF-8
        return content.toString('utf-8');

      case '.pdf':
        return this.extractPdfText(content);

      case '.docx':
        return this.extractDocxText(content);

      default:
        // Try to read as text
        try {
          return content.toString('utf-8');
        } catch {
          throw new Error(`Unsupported file type: ${ext}`);
        }
    }
  }

  private async extractPdfText(content: Buffer): Promise<string> {
    try {
      if (!pdfParse) {
        const pdfModule = await import('pdf-parse');
        pdfParse = pdfModule.default || pdfModule;
      }
      const result = await pdfParse(content);
      return result.text || '';
    } catch (err: any) {
      throw new Error(`PDF extraction failed: ${err.message}`);
    }
  }

  private async extractDocxText(content: Buffer): Promise<string> {
    try {
      if (!mammoth) {
        mammoth = await import('mammoth');
      }
      const result = await mammoth.extractRawText({ buffer: content });
      return result.value || '';
    } catch (err: any) {
      throw new Error(`DOCX extraction failed: ${err.message}`);
    }
  }

  private chunkText(text: string, chunkSize: number): Array<{ text: string; start: number; end: number }> {
    const chunks: Array<{ text: string; start: number; end: number }> = [];
    const overlap = Math.floor(chunkSize * 0.1); // 10% overlap

    let start = 0;
    while (start < text.length) {
      let end = Math.min(start + chunkSize, text.length);

      // Try to break at a sentence or word boundary
      if (end < text.length) {
        // Look for sentence ending
        const sentenceEnd = text.lastIndexOf('. ', end);
        if (sentenceEnd > start && sentenceEnd > end - 100) {
          end = sentenceEnd + 1;
        } else {
          // Look for word boundary
          const spaceIndex = text.lastIndexOf(' ', end);
          if (spaceIndex > start) {
            end = spaceIndex;
          }
        }
      }

      chunks.push({
        text: text.slice(start, end).trim(),
        start,
        end,
      });

      // Move start with overlap
      start = end - overlap;
      if (start >= end) start = end; // Ensure progress
    }

    return chunks;
  }

  private async cleanupDeletedFiles(): Promise<void> {
    const docsDir = PATHS.docs;
    const dbPaths = this.repository.getAllDocumentPaths();

    for (const dbPath of dbPaths) {
      const exists = await fs.pathExists(dbPath);
      if (!exists || !dbPath.startsWith(docsDir)) {
        // File was deleted or moved outside docs dir
        const doc = this.repository.findByPath(dbPath);
        if (doc) {
          this.repository.deleteDocument(doc.id);
          this.display.log(`Removed deleted document: ${dbPath}`, { source: 'Link' });
        }
      }
    }
  }

  private getMimeType(filepath: string): string | null {
    const ext = path.extname(filepath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.json': 'application/json',
      '.csv': 'text/csv',
      '.ts': 'text/typescript',
      '.js': 'text/javascript',
      '.py': 'text/x-python',
      '.java': 'text/x-java',
      '.cpp': 'text/x-c++src',
      '.c': 'text/x-csrc',
      '.h': 'text/x-cheader',
      '.hpp': 'text/x-c++hdr',
      '.html': 'text/html',
      '.css': 'text/css',
      '.xml': 'application/xml',
      '.yaml': 'application/yaml',
      '.yml': 'application/yaml',
    };
    return mimeTypes[ext] || null;
  }
}
