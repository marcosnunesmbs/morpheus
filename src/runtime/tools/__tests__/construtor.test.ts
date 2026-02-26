import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Construtor } from '../factory.js';
import { MCPToolCache } from '../cache.js';

vi.mock("../cache.js", () => {
  const mockCache = {
    ensureLoaded: vi.fn().mockResolvedValue(undefined),
    getTools: vi.fn().mockReturnValue([{ name: 'tool1' }, { name: 'tool2' }]),
    getStats: vi.fn().mockReturnValue({
      totalTools: 2,
      servers: [{ name: 'server1', toolCount: 2, ok: true }],
      lastLoadedAt: new Date(),
      isLoading: false,
    }),
    reload: vi.fn().mockResolvedValue(undefined),
  };
  return {
    MCPToolCache: {
      getInstance: () => mockCache,
    },
  };
});

vi.mock("../../display.js", () => ({
  DisplayManager: {
    getInstance: () => ({
      log: vi.fn(),
    })
  }
}));

describe('Construtor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create tools from cache successfully', async () => {
    const tools = await Construtor.create();
    
    const cache = MCPToolCache.getInstance();
    expect(cache.ensureLoaded).toHaveBeenCalled();
    expect(cache.getTools).toHaveBeenCalled();
    expect(tools).toHaveLength(2);
  });

  it('should probe servers from cache stats', async () => {
    const results = await Construtor.probe();
    
    const cache = MCPToolCache.getInstance();
    expect(cache.ensureLoaded).toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('server1');
    expect(results[0].toolCount).toBe(2);
    expect(results[0].ok).toBe(true);
  });

  it('should reload cache when reload is called', async () => {
    await Construtor.reload();
    
    const cache = MCPToolCache.getInstance();
    expect(cache.reload).toHaveBeenCalled();
  });

  it('should return cache stats', () => {
    const stats = Construtor.getStats();
    
    expect(stats.totalTools).toBe(2);
    expect(stats.servers).toHaveLength(1);
  });
});
