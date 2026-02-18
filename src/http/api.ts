
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
import { Construtor } from '../runtime/tools/factory.js';
import { getDb } from '../runtime/memory/db.js';
import { ProjectStore } from '../projects/store.js';
import { TaskStore } from '../tasks/store.js';
import { PermissionStore } from '../permissions/store.js';
import type { CreateProjectInput, UpdateProjectInput } from '../projects/types.js';
import type { TaskFilter } from '../tasks/types.js';
import type { GrantPermissionInput } from '../permissions/types.js';
import { Oracle } from '../runtime/oracle.js';

async function readLastLines(filePath: string, n: number): Promise<string[]> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.trim().split('\n');
    return lines.slice(-n);
  } catch (err) {
    return [];
  }
}

export function createApiRouter(oracle: IOracle) {
  const router = Router();
  const configManager = ConfigManager.getInstance();
  const history = new SQLiteChatMessageHistory({ sessionId: 'api-reader' });

  // --- Session Management ---

  router.get('/sessions', async (req, res) => {
    try {
      const allSessions = await history.listSessions();
      res.json(allSessions);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/sessions', async (req, res) => {
    try {
      await history.createNewSession();
      const newSessionId = await history.getCurrentSessionOrCreate(); // Should be the new one
      res.json({ success: true, id: newSessionId, message: 'New session started' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/sessions/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await history.deleteSession(id);
      res.json({ success: true, message: 'Session deleted' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/sessions/:id/archive', async (req, res) => {
    try {
      const { id } = req.params;
      await history.archiveSession(id);
      res.json({ success: true, message: 'Session archived' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.patch('/sessions/:id/title', async (req, res) => {
    try {
      const { id } = req.params;
      const { title } = req.body;
      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }
      await history.renameSession(id, title);
      res.json({ success: true, message: 'Session renamed' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/sessions/:id/messages', async (req, res) => {
    const { id } = req.params;
    const sessionHistory = new SQLiteChatMessageHistory({ sessionId: id, limit: 100 });
    try {
      const messages = await sessionHistory.getMessages();

      // Normalize messages for UI
      const normalizedMessages = messages.map((msg: any) => {
        const type = msg._getType ? msg._getType() : 'unknown';
        return {
          type,
          content: msg.content,
          tool_calls: (msg as any).tool_calls,
          usage_metadata: (msg as any).usage_metadata
        };
      });

      // Reverse to chronological order for UI
      res.json(normalizedMessages.reverse());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    } finally {
      sessionHistory.close();
    }
  });

  // --- Chat Interaction ---

  const ChatSchema = z.object({
    message: z.string().min(1).max(32_000),
    sessionId: z.string().min(1)
  });

  router.post('/chat', async (req, res) => {
    const parsed = ChatSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.message });
    }

    try {
      const { message, sessionId } = parsed.data;
      await (oracle as any).setSessionId(sessionId);
      const response = await oracle.chat(message);
      res.json({ response });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Legacy /session/reset (keep for backward compat or redirect to POST /sessions)
  router.post('/session/reset', async (req, res) => {
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

  // --- Model Pricing ---

  const ModelPricingSchema = z.object({
    provider: z.string().min(1),
    model: z.string().min(1),
    input_price_per_1m: z.number().nonnegative(),
    output_price_per_1m: z.number().nonnegative()
  });

  router.get('/model-pricing', (req, res) => {
    try {
      const h = new SQLiteChatMessageHistory({ sessionId: 'api-reader' });
      const entries = h.listModelPricing();
      h.close();
      res.json(entries);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/model-pricing', (req, res) => {
    const parsed = ModelPricingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.issues });
    }
    try {
      const h = new SQLiteChatMessageHistory({ sessionId: 'api-reader' });
      h.upsertModelPricing(parsed.data);
      h.close();
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.put('/model-pricing/:provider/:model', (req, res) => {
    const { provider, model } = req.params;
    const partial = z.object({
      input_price_per_1m: z.number().nonnegative().optional(),
      output_price_per_1m: z.number().nonnegative().optional()
    }).safeParse(req.body);
    if (!partial.success) {
      return res.status(400).json({ error: 'Invalid payload', details: partial.error.issues });
    }
    try {
      const h = new SQLiteChatMessageHistory({ sessionId: 'api-reader' });
      const existing = h.listModelPricing().find(e => e.provider === provider && e.model === model);
      if (!existing) {
        h.close();
        return res.status(404).json({ error: 'Pricing entry not found' });
      }
      h.upsertModelPricing({
        provider,
        model,
        input_price_per_1m: partial.data.input_price_per_1m ?? existing.input_price_per_1m,
        output_price_per_1m: partial.data.output_price_per_1m ?? existing.output_price_per_1m
      });
      h.close();
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.delete('/model-pricing/:provider/:model', (req, res) => {
    const { provider, model } = req.params;
    try {
      const h = new SQLiteChatMessageHistory({ sessionId: 'api-reader' });
      const changes = h.deleteModelPricing(provider, model);
      h.close();
      if (changes === 0) return res.status(404).json({ error: 'Pricing entry not found' });
      res.json({ success: true });
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

  router.post('/mcp/reload', async (_req, res) => {
    try {
      await oracle.reloadTools();
      res.json({ ok: true, message: 'MCP tools reloaded successfully.' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to reload MCP tools.', details: String(error) });
    }
  });

  router.get('/mcp/status', async (_req, res) => {
    try {
      const results = await Construtor.probe();
      res.json({ servers: results });
    } catch (error) {
      res.status(500).json({ error: 'Failed to probe MCP servers.', details: String(error) });
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

  // ── Projects ────────────────────────────────────────────────────────────────

  const ProjectInputSchema = z.object({
    name: z.string().min(1),
    path: z.string().min(1),
    description: z.string().optional(),
    git_remote: z.string().optional(),
    allowed_commands: z.array(z.string()).optional(),
  });

  router.get('/projects', (_req, res) => {
    try {
      const db = getDb();
      const store = new ProjectStore(db);
      res.json(store.list());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/projects', (req, res) => {
    const parsed = ProjectInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    try {
      const db = getDb();
      const store = new ProjectStore(db);
      const project = store.create(parsed.data as CreateProjectInput);
      res.status(201).json(project);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/projects/:id', (req, res) => {
    try {
      const db = getDb();
      const store = new ProjectStore(db);
      const project = store.getById(req.params.id);
      if (!project) return res.status(404).json({ error: 'Project not found' });
      res.json(project);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/projects/:id', (req, res) => {
    const parsed = ProjectInputSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    try {
      const db = getDb();
      const store = new ProjectStore(db);
      const project = store.update(req.params.id, parsed.data as UpdateProjectInput);
      if (!project) return res.status(404).json({ error: 'Project not found' });
      res.json(project);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/projects/:id', (req, res) => {
    try {
      const db = getDb();
      const store = new ProjectStore(db);
      const ok = store.delete(req.params.id);
      if (!ok) return res.status(404).json({ error: 'Project not found' });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Tasks ───────────────────────────────────────────────────────────────────

  router.get('/tasks', (req, res) => {
    try {
      const db = getDb();
      const store = new TaskStore(db);
      const filter: TaskFilter = {
        project_id: req.query.project_id as string | undefined,
        session_id: req.query.session_id as string | undefined,
        status: req.query.status as any,
        assigned_to: req.query.assigned_to as any,
      };
      res.json(store.list(filter));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/tasks/:id', (req, res) => {
    try {
      const db = getDb();
      const store = new TaskStore(db);
      const task = store.getById(req.params.id);
      if (!task) return res.status(404).json({ error: 'Task not found' });
      res.json(task);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/tasks/:id/approve', (req, res) => {
    try {
      const db = getDb();
      const store = new TaskStore(db);
      const task = store.update(req.params.id, {
        status: 'pending',
        approved_at: Date.now(),
        approved_by: 'user',
      });
      if (!task) return res.status(404).json({ error: 'Task not found' });
      res.json(task);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/tasks/:id/cancel', (req, res) => {
    try {
      const db = getDb();
      const store = new TaskStore(db);
      const task = store.getById(req.params.id);
      if (!task) return res.status(404).json({ error: 'Task not found' });
      if (['done', 'failed', 'cancelled'].includes(task.status)) {
        return res.status(400).json({ error: `Cannot cancel task in status: ${task.status}` });
      }
      const updated = store.update(req.params.id, { status: 'cancelled' });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Config / Agents ──────────────────────────────────────────────────────────

  router.get('/config/agents', (_req, res) => {
    try {
      res.json(configManager.getAgentsConfig());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/config/agents', async (req, res) => {
    try {
      await configManager.save({ agents: req.body });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Permissions ─────────────────────────────────────────────────────────────

  const PermissionInputSchema = z.object({
    action_type: z.string().min(1),
    scope: z.enum(['session', 'project', 'global']),
    scope_id: z.string().optional(),
    expires_at: z.number().optional(),
  });

  router.get('/permissions', (req, res) => {
    try {
      const db = getDb();
      const store = new PermissionStore(db);
      res.json(store.list(req.query.scope as any, req.query.scope_id as string | undefined));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/permissions', (req, res) => {
    const parsed = PermissionInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    try {
      const db = getDb();
      const store = new PermissionStore(db);
      const permission = store.grant(parsed.data as GrantPermissionInput);
      res.status(201).json(permission);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/permissions/:id', (req, res) => {
    try {
      const db = getDb();
      const store = new PermissionStore(db);
      store.revoke(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Approvals ────────────────────────────────────────────────────────────────

  router.get('/approvals', (req, res) => {
    try {
      const db = getDb();
      const store = new PermissionStore(db);
      const status = (req.query.status as string) || 'pending';
      const session_id = req.query.session_id as string | undefined;
      res.json(store.listApprovalRequests(session_id, status as any));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  const ResolveApprovalSchema = z.object({
    decision: z.enum(['approve', 'deny', 'approve_always']),
    scope: z.enum(['session', 'project', 'global']).optional(),
  });

  router.post('/approvals/:id/resolve', (req, res) => {
    const parsed = ResolveApprovalSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', issues: parsed.error.issues });
    }
    try {
      const db = getDb();
      const store = new PermissionStore(db);
      const { decision, scope } = parsed.data;

      let approvalStatus: 'approved' | 'denied' | 'approved_always';
      if (decision === 'approve') approvalStatus = 'approved';
      else if (decision === 'approve_always') approvalStatus = 'approved_always';
      else approvalStatus = 'denied';

      const updated = store.resolveApprovalRequest(req.params.id, approvalStatus, scope);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── SSE — Proactive Messages ─────────────────────────────────────────────────

  router.get('/chat/events/:sessionId', (req, res) => {
    const { sessionId } = req.params;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Listen for proactive messages from Oracle
    const oracleInstance = oracle as Oracle;
    const onMessage = (payload: { sessionId: string; message: string }) => {
      if (payload.sessionId !== sessionId) return;
      res.write(`data: ${JSON.stringify({ type: 'message', content: payload.message })}\n\n`);
    };

    if (typeof oracleInstance.on === 'function') {
      oracleInstance.on('proactive_message', onMessage);
    }

    // Heartbeat every 30s
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 30_000);

    req.on('close', () => {
      clearInterval(heartbeat);
      if (typeof oracleInstance.off === 'function') {
        oracleInstance.off('proactive_message', onMessage);
      }
    });
  });

  return router;
}
