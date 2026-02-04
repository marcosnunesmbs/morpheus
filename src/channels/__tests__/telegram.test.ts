import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TelegramAdapter } from '../telegram.js';
import { Oracle } from '../../runtime/oracle.js';

// Mock dependencies
vi.mock('telegraf', () => {
  return {
    Telegraf: class {
      telegram: any;
      on: any;
      launch: any;
      stop: any;
      constructor() {
        this.telegram = {
            getMe: vi.fn().mockResolvedValue({ username: 'test_bot' }),
        };
        this.on = vi.fn();
        this.launch = vi.fn().mockResolvedValue(undefined);
        this.stop = vi.fn();
      }
    }
  };
});

vi.mock('../../runtime/display.js', () => ({
  DisplayManager: {
    getInstance: () => ({
      log: vi.fn(),
    }),
  },
}));

describe('TelegramAdapter', () => {
  let adapter: TelegramAdapter;
    let mockOracle: Oracle;

    beforeEach(() => {
        mockOracle = {
            chat: vi.fn(),
        } as unknown as Oracle;
        adapter = new TelegramAdapter(mockOracle);
    });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Authorization', () => {
    it('should be able to authorize trusted users', () => {
      // Accessing private method for unit testing
      const isAuthorized = (adapter as any).isAuthorized.bind(adapter);
      
      const allowed = ['123', '456'];
      expect(isAuthorized('123', allowed)).toBe(true);
      expect(isAuthorized('456', allowed)).toBe(true);
      expect(isAuthorized('789', allowed)).toBe(false);
    });

    it('should handle numeric inputs converted to strings', () => {
        const isAuthorized = (adapter as any).isAuthorized.bind(adapter);
        const allowed = ['123'];
        // Telegram ID comes as string from our logic, but let's verify string comparison
        expect(isAuthorized('123', allowed)).toBe(true);
        expect(isAuthorized('1234', allowed)).toBe(false);
    });
  });

  describe('Connection', () => {
    it('should connect successfully with token', async () => {
        await expect(adapter.connect('fake_token', ['123'])).resolves.not.toThrow();
    });
  });
});
