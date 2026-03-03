import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs-extra';
import * as path from 'path';
import { tmpdir } from 'os';
import { SetupRepository } from '../repository.js';
import { ConfigManager } from '../../../config/manager.js';

// Mock ConfigManager so tests are not coupled to the real config file
vi.mock('../../../config/manager.js', () => ({
  ConfigManager: {
    getInstance: vi.fn(() => ({
      getSetupConfig: vi.fn(() => ({ enabled: true, fields: ['name', 'city'] })),
    })),
  },
}));

describe('SetupRepository', () => {
  let testDbPath: string;

  beforeEach(() => {
    const tempDir = path.join(tmpdir(), 'morpheus-setup-test', Date.now().toString());
    fs.ensureDirSync(tempDir);
    testDbPath = path.join(tempDir, 'short-memory.db');
    // Reset singleton so each test gets a fresh instance
    SetupRepository.resetInstance();
  });

  afterEach(() => {
    SetupRepository.resetInstance();
    // Clean up temp DB
    const tempDir = path.dirname(testDbPath);
    try {
      fs.removeSync(tempDir);
    } catch {
      // ignore — Windows may delay file release
    }
  });

  describe('initialize()', () => {
    it('should create setup_state table on construction', () => {
      const repo = SetupRepository.getInstance(testDbPath);
      // If table was created, isCompleted() should not throw
      expect(() => repo.isCompleted()).not.toThrow();
    });
  });

  describe('isCompleted()', () => {
    it('returns false when __completed__ record does not exist', () => {
      const repo = SetupRepository.getInstance(testDbPath);
      expect(repo.isCompleted()).toBe(false);
    });

    it('returns true after markCompleted() is called', () => {
      const repo = SetupRepository.getInstance(testDbPath);
      repo.markCompleted();
      expect(repo.isCompleted()).toBe(true);
    });

    it('returns true when setup.enabled is false even without __completed__ record', () => {
      // Override mock for this test only
      vi.mocked(ConfigManager.getInstance).mockReturnValueOnce({
        getSetupConfig: vi.fn(() => ({ enabled: false, fields: ['name'] })),
      } as any);

      const repo = SetupRepository.getInstance(testDbPath);
      expect(repo.isCompleted()).toBe(true);
    });
  });

  describe('saveField() / getMissingFields()', () => {
    it('getMissingFields returns all configured fields initially', () => {
      const repo = SetupRepository.getInstance(testDbPath);
      const missing = repo.getMissingFields();
      expect(missing).toEqual(['name', 'city']);
    });

    it('removes a field from missing list after saving it', () => {
      const repo = SetupRepository.getInstance(testDbPath);
      repo.saveField('name', 'João');
      const missing = repo.getMissingFields();
      expect(missing).toEqual(['city']);
      expect(missing).not.toContain('name');
    });

    it('returns empty array when all fields are saved', () => {
      const repo = SetupRepository.getInstance(testDbPath);
      repo.saveField('name', 'João');
      repo.saveField('city', 'Brasília');
      expect(repo.getMissingFields()).toEqual([]);
    });

    it('upserts a field on second save', () => {
      const repo = SetupRepository.getInstance(testDbPath);
      repo.saveField('name', 'João');
      repo.saveField('name', 'Carlos');
      // Should still have only one entry for name (no duplicate)
      expect(repo.getMissingFields()).toEqual(['city']);
    });
  });

  describe('markCompleted()', () => {
    it('is idempotent (can be called multiple times without error)', () => {
      const repo = SetupRepository.getInstance(testDbPath);
      expect(() => {
        repo.markCompleted();
        repo.markCompleted();
        repo.markCompleted();
      }).not.toThrow();
      expect(repo.isCompleted()).toBe(true);
    });
  });

  describe('reset()', () => {
    it('clears all records including __completed__', () => {
      const repo = SetupRepository.getInstance(testDbPath);
      repo.saveField('name', 'João');
      repo.saveField('city', 'Brasília');
      repo.markCompleted();

      expect(repo.isCompleted()).toBe(true);

      repo.reset();

      expect(repo.isCompleted()).toBe(false);
      expect(repo.getMissingFields()).toEqual(['name', 'city']);
    });

    it('is safe to call on empty table', () => {
      const repo = SetupRepository.getInstance(testDbPath);
      expect(() => repo.reset()).not.toThrow();
    });
  });
});
