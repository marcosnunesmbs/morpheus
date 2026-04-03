import { Router } from 'express';
import { GwsOAuthManager } from '../../runtime/gws-oauth/manager.js';

/**
 * Creates the GWS OAuth router with setup, status, revoke, and refresh endpoints.
 * This router is mounted BEFORE auth middleware in server.ts.
 */
export function createGwsRouter(gwsManager: GwsOAuthManager): Router {
  const router = Router();

  // GET /api/gws/oauth/status
  router.get('/oauth/status', async (_req, res) => {
    try {
      const status = await gwsManager.getStatus();
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/gws/oauth/setup
  router.post('/oauth/setup', async (req, res) => {
    try {
      const { scopes } = req.body ?? {};
      const result = await gwsManager.setup(scopes);
      res.json(result);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return res.status(400).json({
          error: 'gws_binary_not_found',
          message: error.message,
          fallback: 'service_account',
        });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/gws/oauth/revoke
  router.delete('/oauth/revoke', async (_req, res) => {
    try {
      await gwsManager.revoke();
      res.json({ status: 'revoked', message: 'GWS OAuth tokens revoked' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /api/gws/oauth/refresh
  router.post('/oauth/refresh', async (req, res) => {
    try {
      const { scopes } = req.body ?? {};
      const result = await gwsManager.refresh(scopes);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // GET /api/gws/oauth/callback — finish OAuth flow (if needed by gws CLI)
  router.get('/oauth/callback', async (req, res) => {
    const { code, state } = req.query;

    if (!code || typeof code !== 'string') {
      res.status(400).send(renderHtml(
        'Authorization Failed',
        'Missing authorization code. Please try again.',
        false,
      ));
      return;
    }

    try {
      // The gws CLI handles the OAuth flow internally, but we can still
      // detect completion via polling. Show a success page.
      res.send(renderHtml(
        'Authorization Received',
        'Your Google Workspace account has been linked. ' +
        'You can close this window and return to Morpheus.',
        true,
      ));
    } catch (error: any) {
      res.status(500).send(renderHtml(
        'Authorization Failed',
        `Error: ${error.message}`,
        false,
      ));
    }
  });

  return router;
}

function renderHtml(title: string, message: string, success: boolean): string {
  const color = success ? '#22c55e' : '#ef4444';
  const icon = success ? '&#10003;' : '&#10007;';
  return `<!DOCTYPE html>
<html><head><title>Morpheus GWS OAuth - ${title}</title>
<style>
  body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center;
         min-height: 100vh; margin: 0; background: #0a0a0a; color: #e0e0e0; }
  .card { text-align: center; padding: 2rem; border: 1px solid ${color}; border-radius: 12px;
          max-width: 400px; background: #111; }
  .icon { font-size: 3rem; color: ${color}; margin-bottom: 1rem; }
  h1 { font-size: 1.25rem; margin: 0 0 1rem; }
  p { color: #999; line-height: 1.5; margin: 0; }
  strong { color: #e0e0e0; }
</style></head>
<body><div class="card">
  <div class="icon">${icon}</div>
  <h1>${title}</h1>
  <p>${message}</p>
</div></body></html>`;
}
