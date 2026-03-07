import { Router } from 'express';
import { SubagentRegistry } from '../../runtime/subagents/registry.js';

export function createAgentsRouter(): Router {
  const router = Router();

  router.get('/metadata', (_req, res) => {
    res.json({ agents: SubagentRegistry.getDisplayMetadata() });
  });

  return router;
}
