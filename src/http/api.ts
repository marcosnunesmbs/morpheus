
import { Router } from 'express';
import { ConfigManager } from '../config/manager.js';
import { PATHS } from '../config/paths.js';
import { DisplayManager } from '../runtime/display.js';
import { writePid, readPid, isProcessRunning, clearPid, checkStalePid } from '../runtime/lifecycle.js';
import fs from 'fs-extra';
import path from 'path';
import { SQLiteChatMessageHistory, SessionStatus } from '../runtime/memory/sqlite.js';
import { SatiRepository } from '../runtime/memory/sati/repository.js';
import { spawn } from 'child_process';
import { z } from 'zod';
import { MCPManager } from '../config/mcp-manager.js';
import { MCPServerConfigSchema } from '../config/schemas.js';
import { IOracle } from '../runtime/types.js';

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
  const history = new SQLiteChatMessageHistory({ sessionId: 'api-reader' });

  router.post('/session/reset', async (req, res) => {
    // if (!oracle) {
    //   return res.status(503).json({ error: 'Oracle unavailable' });
    // }
    try {
      await history.createNewSession();
      res.json({ success: true, message: 'New session started' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/session/status', async (req, res) => {
    try {
      const sessionStatus: SessionStatus | null = await history.getSessionStatus();
      if (!sessionStatus) {
        return res.status(404).json({ error: 'No session found' });
      }
      res.json(sessionStatus);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/status', async (req, res) => {
    let version = 'unknown';
    try {
      const pkg = await fs.readJson(path.join(process.cwd(), 'package.json'));
      version = pkg.version;
    } catch { }

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

  router.post('/restart', async (req, res) => {
    try {
      // Send response immediately before restarting
      res.json({
        success: true,
        message: 'Restart initiated. Process will shut down and restart shortly.'
      });

      // Delay the actual restart to allow response to be sent
      setTimeout(() => {
        // Execute the restart command using the CLI
        const restartProcess = spawn(process.execPath, [process.argv[1], 'restart'], {
          detached: true,
          stdio: 'ignore'
        });

        restartProcess.unref();

        // Exit the current process
        process.exit(0);
      }, 100);

    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/config', (req, res) => {
    res.json(configManager.get());
  });

  router.get('/stats/usage', async (req, res) => {
    try {
      const history = new SQLiteChatMessageHistory({ sessionId: 'api-reader' });
      const stats = await history.getGlobalUsageStats();
      history.close();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/stats/usage/grouped', async (req, res) => {
    try {
      const history = new SQLiteChatMessageHistory({ sessionId: 'api-reader' });
      const stats = await history.getUsageStatsByProviderAndModel();
      history.close();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
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
          source: 'Zaion',
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

  // Sati config endpoints
  router.get('/config/sati', (req, res) => {
    try {
      const satiConfig = configManager.getSatiConfig();
      res.json(satiConfig);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/config/sati', async (req, res) => {
    try {
      const config = configManager.get();
      await configManager.save({ ...config, sati: req.body });

      const display = DisplayManager.getInstance();
      display.log('Sati configuration updated via UI', {
        source: 'Zaion',
        level: 'info'
      });

      res.json({ success: true });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  });

  router.delete('/config/sati', async (req, res) => {
    try {
      const config = configManager.get();
      const { sati: sati, ...restConfig } = config;
      await configManager.save(restConfig);

      const display = DisplayManager.getInstance();
      display.log('Sati configuration removed via UI (falling back to Oracle config)', {
        source: 'Zaion',
        level: 'info'
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Sati memories endpoints
  router.get('/sati/memories', async (req, res) => {
    try {
      const repository = SatiRepository.getInstance();
      const memories = repository.getAllMemories();

      // Convert dates to ISO strings for JSON serialization
      const serializedMemories = memories.map(memory => ({
        ...memory,
        created_at: memory.created_at.toISOString(),
        updated_at: memory.updated_at.toISOString(),
        last_accessed_at: memory.last_accessed_at ? memory.last_accessed_at.toISOString() : null
      }));

      res.json(serializedMemories);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.delete('/sati/memories/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const repository = SatiRepository.getInstance();

      const success = repository.archiveMemory(id);

      if (!success) {
        return res.status(404).json({ error: 'Memory not found' });
      }

      res.json({ success: true, message: 'Memory archived successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/sati/memories/bulk-delete', async (req, res) => {
    try {
      const { ids } = req.body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Ids array is required and cannot be empty' });
      }

      const repository = SatiRepository.getInstance();
      let deletedCount = 0;

      // Use a transaction for atomicity, but check if db is not null
      const db = repository['db'];
      if (!db) {
        return res.status(500).json({ error: 'Database connection is not available' });
      }

      const transaction = db.transaction((memoryIds: string[]) => {
        for (const id of memoryIds) {
          const success = repository.archiveMemory(id);
          if (success) {
            deletedCount++;
          }
        }
      });

      transaction(ids);

      res.json({
        success: true,
        message: `${deletedCount} memories archived successfully`,
        deletedCount
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  const MCPUpsertSchema = z.object({
    name: z.string().min(1),
    config: MCPServerConfigSchema,
  });

  const MCPToggleSchema = z.object({
    enabled: z.boolean(),
  });

  router.get('/mcp/servers', async (_req, res) => {
    try {
      const servers = await MCPManager.listServers();
      res.json({ servers });
    } catch (error) {
      res.status(500).json({ error: 'Failed to load MCP servers.', details: String(error) });
    }
  });

  router.post('/mcp/servers', async (req, res) => {
    try {
      const body = MCPUpsertSchema.parse(req.body);
      await MCPManager.addServer(body.name, body.config);
      res.status(201).json({ ok: true });
    } catch (error) {
      const status = error instanceof z.ZodError ? 400 : 500;
      res.status(status).json({ error: 'Failed to create MCP server.', details: error });
    }
  });

  router.put('/mcp/servers/:name', async (req, res) => {
    try {
      const body = MCPUpsertSchema.parse({ name: req.params.name, config: req.body?.config ?? req.body });
      await MCPManager.updateServer(body.name, body.config);
      res.json({ ok: true });
    } catch (error) {
      const status = error instanceof z.ZodError ? 400 : 500;
      res.status(status).json({ error: 'Failed to update MCP server.', details: error });
    }
  });

  router.delete('/mcp/servers/:name', async (req, res) => {
    try {
      await MCPManager.deleteServer(req.params.name);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete MCP server.', details: String(error) });
    }
  });

  router.patch('/mcp/servers/:name/toggle', async (req, res) => {
    try {
      const body = MCPToggleSchema.parse(req.body);
      await MCPManager.setServerEnabled(req.params.name, body.enabled);
      res.json({ ok: true });
    } catch (error) {
      const status = error instanceof z.ZodError ? 400 : 500;
      res.status(status).json({ error: 'Failed to toggle MCP server.', details: error });
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
