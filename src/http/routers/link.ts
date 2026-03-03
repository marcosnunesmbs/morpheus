import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs-extra';
import { LinkRepository } from '../../runtime/link/repository.js';
import { LinkWorker } from '../../runtime/link/worker.js';
import { ConfigManager } from '../../config/manager.js';
import { PATHS } from '../../config/paths.js';
import { z } from 'zod';
import type { LinkSearchOptions } from '../../runtime/link/types.js';

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await fs.ensureDir(PATHS.docs);
    cb(null, PATHS.docs);
  },
  filename: (req, file, cb) => {
    // Sanitize filename
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueName = `${Date.now()}-${sanitized}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
  fileFilter: (req, file, cb) => {
    const config = ConfigManager.getInstance().getLinkConfig();
    const allowedExtensions = config.allowed_extensions || ['.txt', '.md', '.pdf', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed. Allowed: ${allowedExtensions.join(', ')}`));
    }
  },
});

// Validation schemas
const searchSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(20).optional(),
  scoreThreshold: z.number().min(0).max(1).optional(),
  vectorWeight: z.number().min(0).max(1).optional(),
  bm25Weight: z.number().min(0).max(1).optional(),
});

const configSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'openrouter', 'ollama', 'gemini']).optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(1).optional(),
  api_key: z.string().optional(),
  base_url: z.string().optional(),
  execution_mode: z.enum(['sync', 'async']).optional(),
  chunk_size: z.number().int().min(100).max(2000).optional(),
  score_threshold: z.number().min(0).max(1).optional(),
  vector_weight: z.number().min(0).max(1).optional(),
  bm25_weight: z.number().min(0).max(1).optional(),
  scan_interval_ms: z.number().int().min(5000).optional(),
  max_file_size_mb: z.number().int().min(1).max(100).optional(),
  allowed_extensions: z.array(z.string()).optional(),
});

export function createLinkRouter(): Router {
  const router = Router();
  const repository = LinkRepository.getInstance();

  // GET /api/link/documents - List documents
  router.get('/documents', async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const per_page = Math.min(100, Math.max(1, parseInt(req.query.per_page as string) || 20));
      const status = req.query.status as any;
      const search = req.query.search as string | undefined;

      const result = repository.listDocuments({
        status,
        search,
        page,
        per_page,
      });

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/link/documents/:id - Get single document
  router.get('/documents/:id', async (req: Request, res: Response) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const doc = repository.getDocument(id);
      if (!doc) {
        return res.status(404).json({ error: 'Document not found' });
      }
      res.json(doc);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/link/documents/upload - Upload a file
  router.post('/documents/upload', upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const filePath = req.file.path;
      const filename = req.file.originalname;

      res.json({
        success: true,
        message: 'File uploaded successfully. It will be indexed shortly.',
        filename,
        path: filePath,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/link/documents/:id - Delete a document
  router.delete('/documents/:id', async (req: Request, res: Response) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const doc = repository.getDocument(id);
      if (!doc) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Delete from filesystem
      await fs.remove(doc.filepath);

      // Delete from database
      repository.deleteDocument(id);

      res.json({ success: true, message: 'Document deleted' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/link/search - Search documents
  router.post('/search', async (req: Request, res: Response) => {
    try {
      const validation = searchSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid request',
          issues: validation.error.issues,
        });
      }

      const { query, limit, scoreThreshold, vectorWeight, bm25Weight } = validation.data;

      const startMs = Date.now();
      const results = repository.searchHybrid(
        query,
        await getQueryEmbedding(query),
        limit || 5,
        scoreThreshold || 0.7,
        vectorWeight || 0.8,
        bm25Weight || 0.2
      );
      const durationMs = Date.now() - startMs;

      res.json({
        results: results.map(r => ({
          chunk: r.chunk,
          document: {
            id: r.document.id,
            filename: r.document.filename,
            filepath: r.document.filepath,
          },
          score: r.score,
          vectorScore: r.vectorScore,
          bm25Score: r.bm25Score,
        })),
        totalResults: results.length,
        query,
        durationMs,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/link/stats - Get statistics
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      const stats = repository.getStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/link/reindex/:id - Trigger reindexing of a document
  router.post('/reindex/:id', async (req: Request, res: Response) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const doc = repository.getDocument(id);
      if (!doc) {
        return res.status(404).json({ error: 'Document not found' });
      }

      repository.updateDocumentStatus(id, 'pending');

      res.json({ success: true, message: 'Document queued for reindexing' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

export function createLinkConfigRouter(): Router {
  const router = Router();

  // GET /api/config/link - Get current config
  router.get('/', async (req: Request, res: Response) => {
    try {
      const config = ConfigManager.getInstance().getLinkConfig();
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/config/link - Update config
  router.post('/', async (req: Request, res: Response) => {
    try {
      const validation = configSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid config',
          issues: validation.error.issues,
        });
      }

      const configManager = ConfigManager.getInstance();

      // Update each provided field
      for (const [key, value] of Object.entries(validation.data)) {
        if (value !== undefined) {
          await configManager.set(`link.${key}`, value);
        }
      }

      // Update worker interval if changed
      const newConfig = configManager.getLinkConfig();
      const worker = LinkWorker.getInstance();
      if (worker && newConfig.scan_interval_ms) {
        worker.updateInterval(newConfig.scan_interval_ms);
      }

      res.json({ success: true, config: newConfig });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

/**
 * Get embedding for a query (placeholder - should use actual embedding model)
 */
async function getQueryEmbedding(query: string): Promise<number[]> {
  // This is a placeholder - in production, use the actual embedding model
  // For now, generate a consistent pseudo-embedding
  const embedding: number[] = new Array(384).fill(0);

  for (let i = 0; i < query.length; i++) {
    const charCode = query.charCodeAt(i);
    embedding[i % 384] += charCode / 255;
  }

  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(v => v / (magnitude || 1));
}
