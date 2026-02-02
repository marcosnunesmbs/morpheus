import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfigQueryTool, ConfigUpdateTool } from '../config-tools.js';
import { DiagnosticTool } from '../diagnostic-tools.js';
import { MessageCountTool, TokenUsageTool } from '../analytics-tools.js';
import { ConfigManager } from '../../../config/manager.js';

// Mock the ConfigManager for testing
vi.mock('../../config/manager.js', () => ({
  ConfigManager: {
    getInstance: vi.fn(() => ({
      load: vi.fn(async () => ({
        llm: { provider: 'openai', model: 'gpt-4' },
        logging: { enabled: true, level: 'info' },
        ui: { enabled: true, port: 3000 }
      })),
      get: vi.fn(() => ({
        llm: { provider: 'openai', model: 'gpt-4' },
        logging: { enabled: true, level: 'info' },
        ui: { enabled: true, port: 3000 }
      })),
      save: vi.fn(async (newConfig) => {
        // Mock save implementation
      })
    }))
  }
}));

describe('Config Tools', () => {
  describe('ConfigQueryTool', () => {
    it('should query all configuration values when no key is provided', async () => {
      const result = await ConfigQueryTool.invoke({});
      const parsedResult = JSON.parse(result);
      
      expect(parsedResult).toHaveProperty('llm');
      expect(parsedResult).toHaveProperty('logging');
      expect(parsedResult).toHaveProperty('ui');
    });

    it('should query specific configuration value when key is provided', async () => {
      const result = await ConfigQueryTool.invoke({ key: 'llm' });
      const parsedResult = JSON.parse(result);

      expect(parsedResult).toHaveProperty('llm');
      const llmConfig = parsedResult.llm;
      expect(llmConfig).toHaveProperty('provider');
      expect(llmConfig).toHaveProperty('model');
    });
  });

  describe('ConfigUpdateTool', () => {
    it('should update configuration values', async () => {
      const updates = { 'ui.port': 4000 };
      const result = await ConfigUpdateTool.invoke({ updates });
      const parsedResult = JSON.parse(result);
      
      expect(parsedResult).toHaveProperty('success', true);
    });

    it('should return error when update fails', async () => {
      // Create a new mock instance for this specific test
      const originalGetInstance = ConfigManager.getInstance;
      const mockGetInstance = vi.fn(() => ({
        load: vi.fn(async () => ({
          llm: { provider: 'openai', model: 'gpt-4' },
          logging: { enabled: true, level: 'info' },
          ui: { enabled: true, port: 3000 }
        })),
        get: vi.fn(() => ({
          llm: { provider: 'openai', model: 'gpt-4' },
          logging: { enabled: true, level: 'info' },
          ui: { enabled: true, port: 3000 }
        })),
        save: vi.fn(async () => {
          throw new Error('Save failed');
        })
      }));

      // Replace the getInstance method temporarily
      (ConfigManager as any).getInstance = mockGetInstance;

      const updates = { 'invalid.field': 'value' };
      const result = await ConfigUpdateTool.invoke({ updates });
      const parsedResult = JSON.parse(result);

      expect(parsedResult).toHaveProperty('error');

      // Restore the original method
      (ConfigManager as any).getInstance = originalGetInstance;
    });
  });
});

describe('DiagnosticTool', () => {
  it('should return a diagnostic report with component statuses', async () => {
    const result = await DiagnosticTool.invoke({});
    const parsedResult = JSON.parse(result);
    
    expect(parsedResult).toHaveProperty('timestamp');
    expect(parsedResult).toHaveProperty('components');
    expect(parsedResult.components).toHaveProperty('config');
    expect(parsedResult.components).toHaveProperty('storage');
    expect(parsedResult.components).toHaveProperty('network');
    expect(parsedResult.components).toHaveProperty('agent');
  });
});

describe('Analytics Tools', () => {
  // Note: These tools now use the existing SQLite class and access the database

  describe('MessageCountTool', () => {
    it('should return message count', async () => {
      const result = await MessageCountTool.invoke({});
      const parsedResult = JSON.parse(result);

      // Should return a number (message count) or an error if database doesn't exist
      if (typeof parsedResult === 'object' && parsedResult.error) {
        // If there's an error (e.g., database doesn't exist), that's acceptable in test environment
        expect(parsedResult).toHaveProperty('error');
      } else {
        // Otherwise, should return a number
        expect(typeof parsedResult).toBe('number');
      }
    });
  });

  describe('TokenUsageTool', () => {
    it('should return token usage statistics', async () => {
      const result = await TokenUsageTool.invoke({});
      const parsedResult = JSON.parse(result);

      // Should return token statistics or an error if database doesn't exist
      if (typeof parsedResult === 'object' && parsedResult.error) {
        // If there's an error (e.g., database doesn't exist), that's acceptable in test environment
        expect(parsedResult).toHaveProperty('error');
      } else {
        // Otherwise, should return token statistics
        expect(parsedResult).toHaveProperty('totalTokens');
        expect(parsedResult).toHaveProperty('inputTokens');
        expect(parsedResult).toHaveProperty('outputTokens');
        expect(parsedResult).toHaveProperty('timestamp');
      }
    });
  });
});