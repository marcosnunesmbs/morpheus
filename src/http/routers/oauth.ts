import { Router } from 'express';
import { OAuthManager } from '../../runtime/oauth/manager.js';
import { MCPToolCache } from '../../runtime/tools/cache.js';
import { DisplayManager } from '../../runtime/display.js';

const display = DisplayManager.getInstance();

export function createOAuthRouter(): Router {
  const router = Router();

  /**
   * GET /api/oauth/callback?code=...&state=...
   * Receives the OAuth redirect after user authorizes in their browser.
   */
  router.get('/callback', async (req, res) => {
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
      const oauthManager = OAuthManager.getInstance();
      const result = await oauthManager.finishAuth(code, state as string | undefined);

      display.log(`OAuth callback: '${result.serverName}' authorized (${result.toolCount} tools)`, {
        level: 'info',
        source: 'OAuth',
      });

      // Trigger MCP tool reload in background
      MCPToolCache.getInstance().reload().catch(err => {
        display.log(`Failed to reload MCP tools after OAuth: ${err}`, {
          level: 'warning',
          source: 'OAuth',
        });
      });

      res.send(renderHtml(
        'Authorization Successful',
        `MCP server <strong>${result.serverName}</strong> has been authorized. ` +
        `${result.toolCount} tools are now available. You can close this window.`,
        true,
      ));
    } catch (error: any) {
      display.log(`OAuth callback failed: ${error.message}`, {
        level: 'warning',
        source: 'OAuth',
      });
      res.status(500).send(renderHtml(
        'Authorization Failed',
        `Error: ${error.message}`,
        false,
      ));
    }
  });

  /**
   * GET /api/oauth/status
   * Returns OAuth status for all MCP servers with OAuth data.
   */
  router.get('/status', async (_req, res) => {
    try {
      const oauthManager = OAuthManager.getInstance();
      const statuses = oauthManager.getStatus();
      res.json({ servers: statuses });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  /**
   * DELETE /api/oauth/tokens/:name
   * Revoke and remove stored OAuth token for an MCP server.
   */
  router.delete('/tokens/:name', async (req, res) => {
    try {
      const oauthManager = OAuthManager.getInstance();
      oauthManager.revokeToken(req.params.name);
      res.json({ ok: true, message: `Token revoked for '${req.params.name}'` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

function renderHtml(title: string, message: string, success: boolean): string {
  const color = success ? '#22c55e' : '#ef4444';
  const icon = success ? '&#10003;' : '&#10007;';
  return `<!DOCTYPE html>
<html><head><title>Morpheus OAuth - ${title}</title>
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
