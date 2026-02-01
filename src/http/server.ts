import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { ConfigManager } from '../config/manager.js';
import { DisplayManager } from '../runtime/display.js';
import { createApiRouter } from './api.js';
import { authMiddleware } from './middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class HttpServer {
  private app: express.Application;
  private server: any;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(cors());
    this.app.use(bodyParser.json());
  }

  private setupRoutes() {
    this.app.use('/api', authMiddleware, createApiRouter());

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
