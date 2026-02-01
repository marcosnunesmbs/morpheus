import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import bodyParser from 'body-parser';
import { authMiddleware } from '../middleware/auth.js';
import { AUTH_HEADER } from '../../types/auth.js';
import { DisplayManager } from '../../runtime/display.js';

vi.mock('../../runtime/display.js');

describe('Auth Middleware', () => {
  let app: express.Application;
  let mockDisplayManager: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockDisplayManager = {
      log: vi.fn(),
    };
    (DisplayManager.getInstance as any).mockReturnValue(mockDisplayManager);

    app = express();
    app.use(bodyParser.json());
    app.use(authMiddleware);
    app.get('/test', (req, res) => res.status(200).json({ success: true }));

    // Reset env var
    delete process.env.THE_ARCHITECT_PASS;
  });

  it('should allow access when THE_ARCHITECT_PASS is not set', async () => {
    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should block access when THE_ARCHITECT_PASS is set and header is missing', async () => {
    process.env.THE_ARCHITECT_PASS = 'secret123';
    const res = await request(app).get('/test');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
    expect(mockDisplayManager.log).toHaveBeenCalledWith(
      expect.stringContaining('Unauthorized'),
      expect.objectContaining({ source: 'http', level: 'warning' })
    );
  });

  it('should block access when THE_ARCHITECT_PASS is set and header is incorrect', async () => {
    process.env.THE_ARCHITECT_PASS = 'secret123';
    const res = await request(app)
      .get('/test')
      .set(AUTH_HEADER, 'wrongpass');
    expect(res.status).toBe(401);
    expect(mockDisplayManager.log).toHaveBeenCalled();
  });

  it('should allow access when THE_ARCHITECT_PASS is set and header matches', async () => {
    process.env.THE_ARCHITECT_PASS = 'secret123';
    const res = await request(app)
      .get('/test')
      .set(AUTH_HEADER, 'secret123');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
