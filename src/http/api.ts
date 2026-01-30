
import { Router } from 'express';
import { ConfigManager } from '../config/manager.js';
import { PATHS } from '../config/paths.js';
import { DisplayManager } from '../runtime/display.js';
import fs from 'fs-extra';
import path from 'path';

async function readLastLines(filePath: string, n: number): Promise<string[]> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.trim().split('\n');
    return lines.slice(-n);
  } catch (err) {
    return [];
  }
}

export function createApiRouter() {
  const router = Router();
  const configManager = ConfigManager.getInstance();

  router.get('/status', async (req, res) => {
    let version = 'unknown';
    try {
        const pkg = await fs.readJson(path.join(process.cwd(), 'package.json'));
        version = pkg.version;
    } catch {}

    const config = configManager.get();
    res.json({
      status: 'online',
      uptimeSeconds: process.uptime(),
      pid: process.pid,
      projectVersion: version,
      nodeVersion: process.version,
      agentName: config.agent.name,
      llmProvider: config.llm.provider,
      llmModel: config.llm.model
    });
  });

  router.get('/config', (req, res) => {
    res.json(configManager.get());
  });

  // Calculate diff between two objects
  const getDiff = (obj1: any, obj2: any, prefix = ''): string[] => {
    const changes: string[] = [];
    const keys = new Set([...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})]);

    for (const key of keys) {
        const val1 = obj1?.[key];
        const val2 = obj2?.[key];
        const currentPath = prefix ? `${prefix}.${key}` : key;

        // Skip if identical
        if (JSON.stringify(val1) === JSON.stringify(val2)) continue;

        if (
            typeof val1 === 'object' && val1 !== null &&
            typeof val2 === 'object' && val2 !== null &&
            !Array.isArray(val1) && !Array.isArray(val2)
        ) {
            changes.push(...getDiff(val1, val2, currentPath));
        } else {
            // Mask secrets in logs
            const isSecret = currentPath.includes('key') || currentPath.includes('token');
            const v1Display = isSecret ? '***' : JSON.stringify(val1);
            const v2Display = isSecret ? '***' : JSON.stringify(val2);
            changes.push(`${currentPath}: ${v1Display} -> ${v2Display}`);
        }
    }
    return changes;
  };

  router.post('/config', async (req, res) => {
    try {
      const oldConfig = JSON.parse(JSON.stringify(configManager.get()));
      
      // Save will validate against Zod schema
      await configManager.save(req.body);
      
      const newConfig = configManager.get();
      const changes = getDiff(oldConfig, newConfig);

      if (changes.length > 0) {
        const display = DisplayManager.getInstance();
        display.log(`Configuration updated via UI:\n  - ${changes.join('\n  - ')}`, { 
            source: 'Config', 
            level: 'info' 
        });
      }

      res.json(newConfig);
    } catch (error: any) {
      if (error.name === 'ZodError') {
          res.status(400).json({ error: 'Validation failed', details: error.errors });
      } else {
          res.status(400).json({ error: error.message });
      }
    }
  });

  // Keep PUT for backward compatibility if needed, or remove. 
  // Tasks says Implement POST. I'll remove PUT to avoid confusion or redirect it.
  router.put('/config', async (req, res) => {
      // Redirect to POST logic or just reuse
      res.status(307).redirect(307, '/api/config');
  });

  router.get('/logs', async (req, res) => {
    try {
      await fs.ensureDir(PATHS.logs);
      const files = await fs.readdir(PATHS.logs);
      const logFiles = await Promise.all(
        files.filter(f => f.endsWith('.log')).map(async (name) => {
          const stats = await fs.stat(path.join(PATHS.logs, name));
          return {
            name,
            size: stats.size,
            modified: stats.mtime.toISOString()
          };
        })
      );
      logFiles.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
      res.json(logFiles);
    } catch (e) {
      res.status(500).json({ error: 'Failed to list logs' });
    }
  });

  router.get('/logs/:filename', async (req, res) => {
    const filename = req.params.filename;
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
       return res.status(400).json({ error: 'Invalid filename' });
    }
    
    // Explicitly cast req.query.limit to string, or handle ParsedQs type
    const limitQuery = req.query.limit;
    const limit = limitQuery ? parseInt(String(limitQuery)) : 50;

    const filePath = path.join(PATHS.logs, filename);
    
    if (!await fs.pathExists(filePath)) {
      return res.status(404).json({ error: 'Log file not found' });
    }

    const lines = await readLastLines(filePath, limit);
    res.json({ lines: lines.reverse() });
  });

  return router;
}
