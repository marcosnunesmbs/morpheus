
import { Router } from 'express';
import { ConfigManager } from '../config/manager.js';
import { PATHS } from '../config/paths.js';
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

  router.put('/config', async (req, res) => {
    try {
      await configManager.save(req.body);
      res.json(configManager.get());
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
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
    res.json({ lines });
  });

  return router;
}
