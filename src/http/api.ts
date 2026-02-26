
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
import { TaskRepository } from '../runtime/tasks/repository.js';
import type { OriginChannel, TaskAgent, TaskStatus } from '../runtime/tasks/types.js';
import { DatabaseRegistry } from '../runtime/memory/trinity-db.js';
import { testConnection, introspectSchema } from '../runtime/trinity-connector.js';
import { Trinity } from '../runtime/trinity.js';
import { ChronosRepository } from '../runtime/chronos/repository.js';
import { ChronosWorker } from '../runtime/chronos/worker.js';
import { createChronosJobRouter, createChronosConfigRouter } from './routers/chronos.js';
import { createSkillsRouter } from './routers/skills.js';
import { getActiveEnvOverrides } from '../config/precedence.js';
import { hotReloadConfig, getRestartRequiredChanges } from '../runtime/hot-reload.js';

async function readLastLines(filePath: string, n: number): Promise<string[]> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.trim().split('\n');
    return lines.slice(-n);
  } catch (err) {
    return [];
  }
}

export function createApiRouter(oracle: IOracle, chronosWorker?: ChronosWorker) {
  const router = Router();
  const configManager = ConfigManager.getInstance();
  const history = new SQLiteChatMessageHistory({ sessionId: 'api-reader' });
  const taskRepository = TaskRepository.getInstance();
  const chronosRepo = ChronosRepository.getInstance();
  const worker = chronosWorker ?? ChronosWorker.getInstance()!;

  // Mount Chronos routers
  if (worker) {
    router.use('/chronos', createChronosJobRouter(chronosRepo, worker));
    router.use('/config/chronos', createChronosConfigRouter(worker));
  }

  // Mount Skills router
  router.use('/skills', createSkillsRouter());

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
      const relatedSessionIds = id.startsWith('sati-evaluation-')
        ? [id]
        : [id, `sati-evaluation-${id}`];
      const rows = await sessionHistory.getRawMessagesBySessionIds(relatedSessionIds, 200);

      const normalizedMessages = rows.map((row) => {
        let content = row.content;
        let tool_calls: any[] | undefined;
        let tool_name: string | undefined;
        let tool_call_id: string | undefined;

        if (row.type === 'ai') {
          try {
            const parsed = JSON.parse(row.content);
            if (parsed && typeof parsed === 'object') {
              if (Array.isArray((parsed as any).tool_calls)) {
                tool_calls = (parsed as any).tool_calls;
              }
              if (typeof (parsed as any).text === 'string') {
                content = (parsed as any).text;
              }
            }
          } catch {
            // Keep raw content for legacy/plain-text messages.
          }
        }

        if (row.type === 'tool') {
          try {
            const parsed = JSON.parse(row.content);
            if (parsed && typeof parsed === 'object') {
              if ((parsed as any).content !== undefined) {
                const parsedContent = (parsed as any).content;
                content =
                  typeof parsedContent === 'string'
                    ? parsedContent
                    : JSON.stringify(parsedContent, null, 2);
              }
              if (typeof (parsed as any).name === 'string') {
                tool_name = (parsed as any).name;
              }
              if (typeof (parsed as any).tool_call_id === 'string') {
                tool_call_id = (parsed as any).tool_call_id;
              }
            }
          } catch {
            // Keep raw content for legacy/plain-text tool messages.
          }
        }

        const usage_metadata = row.total_tokens != null
          ? {
              input_tokens: row.input_tokens || 0,
              output_tokens: row.output_tokens || 0,
              total_tokens: row.total_tokens || 0,
              input_token_details: row.cache_read_tokens
                ? { cache_read: row.cache_read_tokens }
                : undefined,
            }
          : undefined;

        return {
          session_id: row.session_id,
          created_at: row.created_at,
          type: row.type,
          content,
          tool_calls,
          tool_name,
          tool_call_id,
          usage_metadata,
        };
      });

      // Convert DESC to ASC for UI rendering
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
      const response = await oracle.chat(message, undefined, false, {
        origin_channel: 'ui',
        session_id: sessionId,
      });
      res.json({ response });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  const TaskStatusSchema = z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']);
  const TaskAgentSchema = z.enum(['apoc', 'neo', 'trinit']);
  const OriginChannelSchema = z.enum(['telegram', 'discord', 'ui', 'api', 'webhook', 'cli']);

  router.get('/tasks', (req, res) => {
    try {
      const status = req.query.status;
      const agent = req.query.agent;
      const originChannel = req.query.origin_channel;
      const sessionId = req.query.session_id;
      const limit = req.query.limit;

      const parsedStatus = typeof status === 'string' ? TaskStatusSchema.safeParse(status) : null;
      const parsedAgent = typeof agent === 'string' ? TaskAgentSchema.safeParse(agent) : null;
      const parsedOrigin = typeof originChannel === 'string' ? OriginChannelSchema.safeParse(originChannel) : null;

      const tasks = taskRepository.listTasks({
        status: parsedStatus?.success ? (parsedStatus.data as TaskStatus) : undefined,
        agent: parsedAgent?.success ? (parsedAgent.data as TaskAgent) : undefined,
        origin_channel: parsedOrigin?.success ? (parsedOrigin.data as OriginChannel) : undefined,
        session_id: typeof sessionId === 'string' ? sessionId : undefined,
        limit: typeof limit === 'string' ? Math.max(1, Math.min(500, Number(limit) || 200)) : 200,
      });

      res.json(tasks);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/tasks/stats', (req, res) => {
    try {
      res.json(taskRepository.getStats());
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/tasks/:id', (req, res) => {
    try {
      const task = taskRepository.getTaskById(req.params.id);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      res.json(task);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/tasks/:id/retry', (req, res) => {
    try {
      const ok = taskRepository.retryTask(req.params.id);
      if (!ok) {
        return res.status(404).json({ error: 'Failed task not found for retry' });
      }
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/tasks/:id/cancel', (req, res) => {
    try {
      const ok = taskRepository.cancelTask(req.params.id);
      if (!ok) {
        return res.status(404).json({ error: 'Active task not found for cancellation' });
      }
      res.json({ success: true });
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

      // Hot-reload agents with new config
      const hotReloadResult = await hotReloadConfig();
      const restartRequired = getRestartRequiredChanges(oldConfig, newConfig);

      res.json({
        ...newConfig,
        _hotReload: hotReloadResult,
        _restartRequired: restartRequired
      });
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

      // Hot-reload agents
      await hotReloadConfig();

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

  // Apoc config endpoints
  router.get('/config/apoc', (req, res) => {
    try {
      const apocConfig = configManager.getApocConfig();
      res.json(apocConfig);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Neo config endpoints
  router.get('/config/neo', (req, res) => {
    try {
      const neoConfig = configManager.getNeoConfig();
      res.json(neoConfig);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/config/neo', async (req, res) => {
    try {
      const config = configManager.get();
      await configManager.save({ ...config, neo: req.body });

      const display = DisplayManager.getInstance();
      display.log('Neo configuration updated via UI', {
        source: 'Zaion',
        level: 'info'
      });

      // Hot-reload agents
      await hotReloadConfig();

      res.json({ success: true });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  });

  router.delete('/config/neo', async (req, res) => {
    try {
      const config = configManager.get();
      const { neo: _neo, ...restConfig } = config;
      await configManager.save(restConfig);

      const display = DisplayManager.getInstance();
      display.log('Neo configuration removed via UI (falling back to Oracle config)', {
        source: 'Zaion',
        level: 'info'
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/config/apoc', async (req, res) => {
    try {
      const config = configManager.get();
      await configManager.save({ ...config, apoc: req.body });

      const display = DisplayManager.getInstance();
      display.log('Apoc configuration updated via UI', {
        source: 'Zaion',
        level: 'info'
      });

      // Hot-reload agents
      await hotReloadConfig();

      res.json({ success: true });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  });

  router.delete('/config/apoc', async (req, res) => {
    try {
      const config = configManager.get();
      const { apoc: _apoc, ...restConfig } = config;
      await configManager.save(restConfig);

      const display = DisplayManager.getInstance();
      display.log('Apoc configuration removed via UI (falling back to Oracle config)', {
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
      // First reload the MCP tool cache from servers
      await Construtor.reload();
      // Then reinitialize agents with the new cached tools
      await oracle.reloadTools();
      const stats = Construtor.getStats();
      res.json({ 
        ok: true, 
        message: 'MCP tools reloaded successfully.',
        totalTools: stats.totalTools,
        servers: stats.servers,
      });
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

  // Get MCP tool cache stats (fast, no server connection)
  router.get('/mcp/stats', async (_req, res) => {
    try {
      const stats = Construtor.getStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get MCP stats.', details: String(error) });
    }
  });

  // Keep PUT for backward compatibility if needed, or remove. 
  // Tasks says Implement POST. I'll remove PUT to avoid confusion or redirect it.
  router.put('/config', async (req, res) => {
    // Redirect to POST logic or just reuse
    res.status(307).redirect(307, '/api/config');
  });

  // ─── Trinity Config ────────────────────────────────────────────────────────

  router.get('/config/trinity', (req, res) => {
    try {
      const trinityConfig = configManager.getTrinityConfig();
      res.json(trinityConfig);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/config/trinity', async (req, res) => {
    try {
      const config = configManager.get();
      await configManager.save({ ...config, trinity: req.body });

      const display = DisplayManager.getInstance();
      display.log('Trinity configuration updated via UI', { source: 'Zaion', level: 'info' });

      // Hot-reload agents
      await hotReloadConfig();

      res.json({ success: true });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        res.status(400).json({ error: 'Validation failed', details: error.errors });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  });

  router.delete('/config/trinity', async (req, res) => {
    try {
      const config = configManager.get();
      const { trinity: _trinity, ...restConfig } = config;
      await configManager.save(restConfig);

      const display = DisplayManager.getInstance();
      display.log('Trinity configuration removed via UI (falling back to Oracle config)', {
        source: 'Zaion',
        level: 'info',
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Encryption Status ─────────────────────────────────────────────────────

  router.get('/config/encryption-status', (req, res) => {
    try {
      const status = configManager.getEncryptionStatus();
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Environment Variable Overrides ────────────────────────────────────────

  router.get('/config/env-overrides', (req, res) => {
    try {
      const overrides = getActiveEnvOverrides();
      // Debug log to see what's being detected
      // console.log('[DEBUG] Env overrides:', JSON.stringify(overrides, null, 2));
      // console.log('[DEBUG] Sample env vars:', {
      //   MORPHEUS_LLM_PROVIDER: !!process.env.MORPHEUS_LLM_PROVIDER,
      //   MORPHEUS_LLM_MODEL: !!process.env.MORPHEUS_LLM_MODEL,
      //   OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      // });
      res.json(overrides);
    } catch (error: any) {
      console.error('[ERROR] Failed to get env overrides:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Trinity Databases CRUD ─────────────────────────────────────────────────

  const DatabaseCreateSchema = z.object({
    name: z.string().min(1).max(100),
    type: z.enum(['postgresql', 'mysql', 'sqlite', 'mongodb']),
    host: z.string().optional().nullable(),
    port: z.number().int().positive().optional().nullable(),
    database_name: z.string().optional().nullable(),
    username: z.string().optional().nullable(),
    password: z.string().optional().nullable(),
    connection_string: z.string().optional().nullable(),
    allow_read: z.boolean().optional(),
    allow_insert: z.boolean().optional(),
    allow_update: z.boolean().optional(),
    allow_delete: z.boolean().optional(),
    allow_ddl: z.boolean().optional(),
  });

  router.get('/trinity/databases', (req, res) => {
    try {
      const registry = DatabaseRegistry.getInstance();
      const databases = registry.listDatabases().map((db) => ({
        ...db,
        password: db.password ? '***' : null,
        connection_string: db.connection_string ? '***' : null,
      }));
      res.json(databases);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/trinity/databases/:id', (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
      const registry = DatabaseRegistry.getInstance();
      const db = registry.getDatabase(id);
      if (!db) return res.status(404).json({ error: 'Database not found' });
      res.json({
        ...db,
        password: db.password ? '***' : null,
        connection_string: db.connection_string ? '***' : null,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/trinity/databases', async (req, res) => {
    const parsed = DatabaseCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    }
    try {
      const registry = DatabaseRegistry.getInstance();
      const db = registry.createDatabase(parsed.data);

      // Test connection
      let connectionOk = false;
      try {
        connectionOk = await testConnection(db);
      } catch { /* ignore */ }

      // Introspect schema if connection successful
      if (connectionOk) {
        try {
          const schema = await introspectSchema(db);
          registry.updateSchema(db.id, JSON.stringify(schema, null, 2));
          await Trinity.refreshDelegateCatalog().catch(() => {});
        } catch { /* ignore schema errors */ }
      }

      const refreshed = registry.getDatabase(db.id)!;
      res.status(201).json({
        ...refreshed,
        password: refreshed.password ? '***' : null,
        connection_string: refreshed.connection_string ? '***' : null,
        connection_ok: connectionOk,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.put('/trinity/databases/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const parsed = DatabaseCreateSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: parsed.error.issues });
    }
    try {
      const registry = DatabaseRegistry.getInstance();
      const updated = registry.updateDatabase(id, parsed.data);
      if (!updated) return res.status(404).json({ error: 'Database not found' });

      // Re-test and re-introspect
      let connectionOk = false;
      try {
        connectionOk = await testConnection(updated);
      } catch { /* ignore */ }

      if (connectionOk) {
        try {
          const schema = await introspectSchema(updated);
          registry.updateSchema(id, JSON.stringify(schema, null, 2));
          await Trinity.refreshDelegateCatalog().catch(() => {});
        } catch { /* ignore */ }
      }

      const refreshed = registry.getDatabase(id)!;
      res.json({
        ...refreshed,
        password: refreshed.password ? '***' : null,
        connection_string: refreshed.connection_string ? '***' : null,
        connection_ok: connectionOk,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.delete('/trinity/databases/:id', (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    try {
      const registry = DatabaseRegistry.getInstance();
      const deleted = registry.deleteDatabase(id);
      if (!deleted) return res.status(404).json({ error: 'Database not found' });
      Trinity.refreshDelegateCatalog().catch(() => {});
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/trinity/databases/:id/refresh-schema', async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    try {
      const registry = DatabaseRegistry.getInstance();
      const db = registry.getDatabase(id);
      if (!db) return res.status(404).json({ error: 'Database not found' });

      const schema = await introspectSchema(db);
      registry.updateSchema(id, JSON.stringify(schema, null, 2));
      await Trinity.refreshDelegateCatalog().catch(() => {});

      const tableNames = schema.databases
        ? schema.databases.flatMap((d) => d.tables.map((t) => `${d.name}.${t.name}`))
        : schema.tables.map((t) => t.name);
      res.json({ success: true, tables: tableNames, databases: schema.databases?.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/trinity/databases/:id/test', async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    try {
      const registry = DatabaseRegistry.getInstance();
      const db = registry.getDatabase(id);
      if (!db) return res.status(404).json({ error: 'Database not found' });

      const ok = await testConnection(db);
      res.json({ success: ok, status: ok ? 'connected' : 'failed' });
    } catch (error: any) {
      res.json({ success: false, status: 'error', error: error.message });
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
    res.json({ lines: lines });
  });

  return router;
}
