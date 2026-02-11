import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import bodyParser from 'body-parser';
import { createApiRouter } from '../api.js';
import { ConfigManager } from '../../config/manager.js';
import { DisplayManager } from '../../runtime/display.js';
import fs from 'fs-extra';

// Mock dependencies
vi.mock('../../config/manager.js');
vi.mock('../../runtime/display.js');
vi.mock('fs-extra');

describe('Config API', () => {
  let app: express.Application;
  let mockConfigManager: any;
  let mockDisplayManager: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock ConfigManager instance
    mockConfigManager = {
      get: vi.fn(),
      save: vi.fn(),
    };
    (ConfigManager.getInstance as any).mockReturnValue(mockConfigManager);

    // Mock DisplayManager instance
    mockDisplayManager = {
      log: vi.fn(),
    };
    (DisplayManager.getInstance as any).mockReturnValue(mockDisplayManager);

    // Mock Oracle instance
    const mockOracle = {
      think: vi.fn(),
      getMemory: vi.fn(),
    } as any;

    // Setup App
    app = express();
    app.use(bodyParser.json());
    app.use('/api', createApiRouter(mockOracle));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/config', () => {
    it('should return current configuration', async () => {
      const mockConfig = { agent: { name: 'TestAgent' } };
      mockConfigManager.get.mockReturnValue(mockConfig);

      const res = await request(app).get('/api/config');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockConfig);
      expect(mockConfigManager.get).toHaveBeenCalled();
    });
  });

  describe('POST /api/config', () => {
    it('should update configuration and return new config', async () => {
      const oldConfig = { agent: { name: 'OldName' } };
      const newConfig = { agent: { name: 'NewName' } };

      mockConfigManager.get.mockReturnValueOnce(oldConfig).mockReturnValue(newConfig);
      mockConfigManager.save.mockResolvedValue(undefined);

      const res = await request(app)
        .post('/api/config')
        .send({ agent: { name: 'NewName' } });

      expect(res.status).toBe(200);
      expect(res.body).toEqual(newConfig);
      expect(mockConfigManager.save).toHaveBeenCalledWith({ agent: { name: 'NewName' } });

      // Verify logging
      expect(mockDisplayManager.log).toHaveBeenCalled();
      const logCall = mockDisplayManager.log.mock.calls[0][0];
      expect(logCall).toContain('agent.name: "OldName" -> "NewName"');
    });

    it('should handle validation errors', async () => {
      mockConfigManager.get.mockReturnValue({});
      const zodError = new Error('Validation failed');
      (zodError as any).name = 'ZodError';
      (zodError as any).errors = [{ message: 'Invalid field' }];

      mockConfigManager.save.mockRejectedValue(zodError);

      const res = await request(app)
        .post('/api/config')
        .send({ invalid: 'data' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
      expect(res.body.details).toBeDefined();
    });
  });
});
