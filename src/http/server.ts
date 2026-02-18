import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { ConfigManager } from '../config/manager.js';
import { DisplayManager } from '../runtime/display.js';
import { createApiRouter } from './api.js';
import { createWebhooksRouter } from './webhooks-router.js';
import { authMiddleware } from './middleware/auth.js';
import { IOracle } from '../runtime/types.js';
import { WebhookDispatcher } from '../runtime/webhooks/dispatcher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class HttpServer {
  private app: express.Application;
  private server: any;
  private oracle: IOracle;

  constructor(oracle: IOracle) {
    this.app = express();
    this.oracle = oracle;
    // Wire Oracle into the webhook dispatcher so triggers use the full agent
    WebhookDispatcher.setOracle(oracle);
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(cors());
    this.app.use(bodyParser.json());

    // Adicionar cabeçalhos para evitar indexação por motores de busca
    this.app.use((req, res, next) => {
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      next();
    });
  }

  private setupRoutes() {
    // Rota de health check pública (sem autenticação)
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

    // Rota de health check para o Docker (padrão)
    this.app.get('/api/health', (req, res) => {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

    // Webhooks router — mounted BEFORE the auth-guarded /api block.
    // The trigger endpoint is public (validated via x-api-key header internally).
    // All other webhook management endpoints apply authMiddleware internally.
    this.app.use('/api/webhooks', createWebhooksRouter());

    this.app.use('/api', authMiddleware, createApiRouter(this.oracle));

    // Serve static frontend from compiled output
    const uiPath = path.resolve(__dirname, '../ui');
    this.app.use(express.static(uiPath));

    // Express 5 requires regex for catch-all instead of '*'
    this.app.get(/.*/, (req, res) => {
      if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'Endpoint not found' });
      }
      res.sendFile(path.join(uiPath, 'index.html'));
    });
  }

  public start(port = 3333): void {
    const config = ConfigManager.getInstance().get();
    if (!config.ui.enabled) {
      return;
    }

    const activePort = config.ui.port || port;

    this.server = this.app.listen(activePort, () => {
      // Intentionally log this to console for user visibility
      DisplayManager.getInstance().log(`Web UI available at http://localhost:${activePort}`, { source: 'Web UI' });
    });
  }

  public stop() {
    if (this.server) {
      this.server.close();
    }
  }
}
