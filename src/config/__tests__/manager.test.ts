import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG } from '../../types/config.js';

describe('ConfigManager', () => {
  it('should have default telegram config properly set', () => {
     const config = DEFAULT_CONFIG;
     expect(config.channels).toBeDefined();
     expect(config.channels.telegram).toBeDefined();
     expect(config.channels.telegram.enabled).toBe(false);
     expect(config.channels.telegram.allowedUsers).toEqual([]);
  });
});
