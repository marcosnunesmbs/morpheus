import { Router } from 'express';
import { SmithRegistry } from '../../runtime/smiths/registry.js';
import { SmithDelegator } from '../../runtime/smiths/delegator.js';
import { ConfigManager } from '../../config/manager.js';
import { SmithEntrySchema } from '../../config/schemas.js';
import { DisplayManager } from '../../runtime/display.js';
import { z } from 'zod';

/**
 * Creates the Smiths API router.
 * Follows the factory-function pattern from chronos.ts.
 */
export function createSmithsRouter(): Router {
  const router = Router();
  const registry = SmithRegistry.getInstance();
  const delegator = SmithDelegator.getInstance();
  const display = DisplayManager.getInstance();

  /**
   * GET /api/smiths — List all registered Smiths with status
   */
  router.get('/', (_req, res) => {
    try {
      const smiths = registry.list().map(s => ({
        name: s.name,
        host: s.host,
        port: s.port,
        state: s.state,
        capabilities: s.capabilities,
        stats: s.stats ?? null,
        lastSeen: s.lastSeen?.toISOString() ?? null,
        error: s.error ?? null,
      }));

      res.json({
        enabled: ConfigManager.getInstance().getSmithsConfig().enabled,
        total: smiths.length,
        online: smiths.filter(s => s.state === 'online').length,
        smiths,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/smiths/config — Get Smiths configuration
   * NOTE: Must be defined BEFORE /:name to avoid "config" matching as a name param.
   */
  router.get('/config', (_req, res) => {
    try {
      const config = ConfigManager.getInstance().getSmithsConfig();
      // Omit auth_tokens from response for security
      const safeEntries = config.entries.map(({ auth_token, ...rest }) => ({
        ...rest,
        auth_token: '***',
      }));

      res.json({
        enabled: config.enabled,
        execution_mode: config.execution_mode,
        heartbeat_interval_ms: config.heartbeat_interval_ms,
        connection_timeout_ms: config.connection_timeout_ms,
        task_timeout_ms: config.task_timeout_ms,
        entries: safeEntries,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * PUT /api/smiths/config — Update Smiths configuration
   */
  router.put('/config', async (req, res) => {
    try {
      const configManager = ConfigManager.getInstance();
      const currentConfig = configManager.get();

      const updated = {
        ...currentConfig,
        smiths: {
          ...currentConfig.smiths,
          ...req.body,
        },
      };

      await configManager.save(updated);

      // Hot-reload: connect new Smiths, disconnect removed ones
      const { added, removed } = await registry.reload();

      res.json({ status: 'updated', added, removed });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/smiths/:name — Get a specific Smith's details
   */
  router.get('/:name', (req, res) => {
    try {
      const smith = registry.get(req.params.name);
      if (!smith) {
        return res.status(404).json({ error: `Smith '${req.params.name}' not found` });
      }

      res.json({
        name: smith.name,
        host: smith.host,
        port: smith.port,
        state: smith.state,
        capabilities: smith.capabilities,
        stats: smith.stats ?? null,
        lastSeen: smith.lastSeen?.toISOString() ?? null,
        error: smith.error ?? null,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/smiths/register — Self-registration endpoint (Smith calls this on boot)
   */
  router.post('/register', (req, res) => {
    try {
      const { name, host, port, auth_token, capabilities } = req.body;

      if (!name || !host || !auth_token) {
        return res.status(400).json({ error: 'Missing required fields: name, host, auth_token' });
      }

      // Validate auth token against configured entries
      const config = ConfigManager.getInstance().getSmithsConfig();
      const configEntry = config.entries.find(e => e.name === name);

      if (configEntry && configEntry.auth_token !== auth_token) {
        display.log(`Smith '${name}' registration rejected: invalid auth token`, {
          source: 'SmithsAPI',
          level: 'warning',
        });
        return res.status(401).json({ error: 'Invalid authentication token' });
      }

      registry.registerFromHandshake(name, host, port ?? 7900, capabilities ?? []);

      display.log(`Smith '${name}' registered via HTTP handshake`, {
        source: 'SmithsAPI',
        level: 'info',
      });

      res.json({ status: 'registered', name });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * POST /api/smiths/:name/ping — Manual ping to test connectivity
   */
  router.post('/:name/ping', async (req, res) => {
    try {
      const result = await delegator.ping(req.params.name);
      res.json({
        online: result.online,
        latency_ms: result.latencyMs ?? null,
        error: result.error ?? null,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * DELETE /api/smiths/:name — Remove a Smith
   */
  router.delete('/:name', (req, res) => {
    try {
      const removed = registry.unregister(req.params.name);
      if (!removed) {
        return res.status(404).json({ error: `Smith '${req.params.name}' not found` });
      }
      res.json({ status: 'removed', name: req.params.name });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
