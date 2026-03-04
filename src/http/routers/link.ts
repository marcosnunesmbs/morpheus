import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import { homedir } from 'os';
import { LinkRepository, Document } from '../../runtime/link-repository.js';
import { LinkWorker } from '../../runtime/link-worker.js';
import { ConfigManager } from '../../config/manager.js';
import type { LinkConfig } from '../../types/config.js';

const DOCS_PATH = path.join(homedir(), '.morpheus', 'docs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await fs.ensureDir(DOCS_PATH);
    cb(null, DOCS_PATH);
  },
  filename: (req, file, cb) => {
    // Multer decodes originalname as Latin1 per HTTP spec.
    // Re-encode to get the raw bytes and decode as UTF-8.
    const fixedName = Buffer.from(file.originalname, 'latin1').toString('utf-8');
    cb(null, fixedName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB default, will check config
  },
  fileFilter: (req, file, cb) => {
    const name = Buffer.from(file.originalname, 'latin1').toString('utf-8');
    const ext = path.extname(name).toLowerCase();
    const allowed = ['.pdf', '.txt', '.md', '.docx'];
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}. Allowed: ${allowed.join(', ')}`));
    }
  },
});

/**
 * Create the Link router for document management.
 */
export function createLinkRouter(): Router {
  const router = Router();
  const repository = LinkRepository.getInstance();
  const worker = LinkWorker.getInstance();

  // GET /api/link/documents - List all documents
  router.get('/documents', (req: Request, res: Response) => {
    try {
      const status = req.query.status as string | undefined;
      const documents = repository.listDocuments(status as any);
      const stats = repository.getStats();

      res.json({
        documents,
        stats,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/link/documents/:id - Get single document
  router.get('/documents/:id', (req: Request, res: Response) => {
    try {
      const document = repository.getDocument(req.params.id as string);
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Also fetch chunks
      const chunks = repository.getChunksByDocument(req.params.id as string);

      res.json({ document, chunks });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/link/documents/upload - Upload a new document
  router.post('/documents/upload', async (req: Request, res: Response) => {
    try {
      const config = ConfigManager.getInstance().getLinkConfig();
      const maxSizeMB = config.max_file_size_mb;

      // Configure multer with config max size
      const uploadWithConfig = multer({
        storage,
        limits: { fileSize: maxSizeMB * 1024 * 1024 },
        fileFilter: (req, file, cb) => {
          const name = Buffer.from(file.originalname, 'latin1').toString('utf-8');
          const ext = path.extname(name).toLowerCase();
          const allowed = ['.pdf', '.txt', '.md', '.docx'];
          if (allowed.includes(ext)) {
            cb(null, true);
          } else {
            cb(new Error(`Unsupported file type: ${ext}`));
          }
        },
      });

      // Handle upload
      await new Promise<void>((resolve, reject) => {
        uploadWithConfig.single('file')(req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Trigger immediate scan
      const result = await worker.tick();

      res.json({
        message: 'File uploaded successfully',
        filename: Buffer.from(req.file.originalname, 'latin1').toString('utf-8'),
        path: req.file.path,
        indexed: result.indexed,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/link/documents/:id - Delete a document
  router.delete('/documents/:id', async (req: Request, res: Response) => {
    try {
      const document = repository.getDocument(req.params.id as string);
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Delete from repository (CASCADE removes chunks and embeddings)
      const deleted = repository.deleteDocument(req.params.id as string);

      // Also delete file from disk
      try {
        await fs.unlink(document.file_path);
      } catch {
        // File may not exist, ignore
      }

      res.json({ message: 'Document deleted', deleted });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/link/documents/:id/reindex - Force reindex a document
  router.post('/documents/:id/reindex', async (req: Request, res: Response) => {
    try {
      const document = repository.getDocument(req.params.id as string);
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Check if file still exists
      const exists = await fs.pathExists(document.file_path);
      if (!exists) {
        return res.status(400).json({ error: 'Document file no longer exists' });
      }

      // Reset status to pending and trigger processing
      repository.updateDocumentStatus(req.params.id as string, 'pending');

      // Process the document
      const result = await worker.processDocument(document.file_path);

      res.json({
        message: 'Document reindexed',
        result,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/link/config - Get Link configuration
  router.get('/config', (req: Request, res: Response) => {
    try {
      const config = ConfigManager.getInstance().getLinkConfig();
      res.json(config);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/link/config - Update Link configuration (partial update)
  router.post('/config', async (req: Request, res: Response) => {
    try {
      const configManager = ConfigManager.getInstance();
      const currentConfig = configManager.get();
      const currentLinkConfig = configManager.getLinkConfig();
      const updates = req.body as Partial<LinkConfig>;

      // Merge updates with current config (ensuring all required fields are present)
      const newLinkConfig: LinkConfig = {
        ...currentLinkConfig,
        ...updates,
      };

      // Save to zaion.yaml
      await configManager.save({
        ...currentConfig,
        link: newLinkConfig,
      });

      // Update worker interval if changed
      if (updates.scan_interval_ms) {
        worker.updateInterval(updates.scan_interval_ms);
      }

      res.json({
        message: 'Configuration updated',
        config: configManager.getLinkConfig(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/link/worker/scan - Trigger manual scan
  router.post('/worker/scan', async (req: Request, res: Response) => {
    try {
      const result = await worker.tick();
      res.json({
        message: 'Scan completed',
        ...result,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/link/worker/status - Get worker status
  router.get('/worker/status', (req: Request, res: Response) => {
    try {
      const config = ConfigManager.getInstance().getLinkConfig();
      const stats = repository.getStats();

      res.json({
        running: true, // Worker is always running when daemon is up
        scan_interval_ms: config.scan_interval_ms,
        ...stats,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}