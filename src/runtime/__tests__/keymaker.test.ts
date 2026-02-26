import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Keymaker, executeKeymakerTask } from '../keymaker.js';
import { SkillRegistry } from '../skills/registry.js';

// Mock all heavy dependencies
vi.mock('../skills/registry.js', () => ({
  SkillRegistry: {
    getInstance: vi.fn(),
  },
}));

vi.mock('../../config/manager.js', () => ({
  ConfigManager: {
    getInstance: vi.fn(() => ({
      get: vi.fn(() => ({
        llm: {
          provider: 'openai',
          model: 'gpt-4o',
          temperature: 0.7,
        },
        keymaker: {
          provider: 'openai',
          model: 'gpt-4o',
          personality: 'versatile_specialist',
        },
      })),
    })),
  },
}));

vi.mock('../display.js', () => ({
  DisplayManager: {
    getInstance: vi.fn(() => ({
      log: vi.fn(),
    })),
  },
}));

vi.mock('../../devkit/index.js', () => ({
  buildDevKit: vi.fn(() => [
    { name: 'fs_read', description: 'Read file' },
    { name: 'shell_exec', description: 'Execute shell command' },
  ]),
}));

vi.mock('../tools/factory.js', () => ({
  Construtor: {
    create: vi.fn(() => Promise.resolve([
      { name: 'mcp_tool', description: 'MCP tool' },
    ])),
  },
}));

vi.mock('../tools/index.js', () => ({
  morpheusTools: [
    { name: 'morpheus_tool', description: 'Internal tool' },
  ],
}));

vi.mock('../providers/factory.js', () => ({
  ProviderFactory: {
    createBare: vi.fn(() => Promise.resolve({
      invoke: vi.fn(),
    })),
  },
}));

vi.mock('../memory/sqlite.js', () => {
  return {
    SQLiteChatMessageHistory: class MockSQLiteChatMessageHistory {
      addMessage = vi.fn();
      close = vi.fn();
    },
  };
});

describe('Keymaker', () => {
  const mockRegistry = {
    get: vi.fn(),
    getContent: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (SkillRegistry.getInstance as ReturnType<typeof vi.fn>).mockReturnValue(mockRegistry);
    mockRegistry.get.mockReturnValue({
      name: 'test-skill',
      description: 'A test skill',
      tags: ['test'],
      enabled: true,
    });
    mockRegistry.getContent.mockReturnValue('# Test Skill\n\nInstructions here.');
  });

  describe('constructor', () => {
    it('should create instance with skill name and content', () => {
      const keymaker = new Keymaker('test-skill', '# Instructions');
      expect(keymaker).toBeInstanceOf(Keymaker);
    });

    it('should accept custom config', () => {
      const customConfig = {
        llm: { provider: 'anthropic', model: 'claude-3' },
      } as any;
      const keymaker = new Keymaker('test-skill', '# Instructions', customConfig);
      expect(keymaker).toBeInstanceOf(Keymaker);
    });
  });

  describe('initialize()', () => {
    it('should initialize agent with all tools', async () => {
      const { ProviderFactory } = await import('../providers/factory.js');
      const { buildDevKit } = await import('../../devkit/index.js');
      const { Construtor } = await import('../tools/factory.js');

      const keymaker = new Keymaker('test-skill', '# Instructions');
      await keymaker.initialize();

      expect(buildDevKit).toHaveBeenCalled();
      expect(Construtor.create).toHaveBeenCalled();
      expect(ProviderFactory.createBare).toHaveBeenCalled();

      // Verify tools were combined
      const createBareCall = (ProviderFactory.createBare as ReturnType<typeof vi.fn>).mock.calls[0];
      const tools = createBareCall[1];
      
      // Should have DevKit (2) + MCP (1) + Morpheus (1) = 4 tools
      expect(tools.length).toBe(4);
    });
  });
});

describe('executeKeymakerTask', () => {
  const mockRegistry = {
    get: vi.fn(),
    getContent: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (SkillRegistry.getInstance as ReturnType<typeof vi.fn>).mockReturnValue(mockRegistry);
  });

  it('should throw error when SKILL.md not found', async () => {
    mockRegistry.getContent.mockReturnValue(null);

    await expect(
      executeKeymakerTask('missing-skill', 'do something')
    ).rejects.toThrow('SKILL.md not found for skill: missing-skill');
  });

  it('should create and execute keymaker with skill content', async () => {
    mockRegistry.getContent.mockReturnValue('# Test Instructions\n\nDo this.');
    mockRegistry.get.mockReturnValue({
      name: 'test-skill',
      description: 'Test skill',
      enabled: true,
    });

    const { ProviderFactory } = await import('../providers/factory.js');
    (ProviderFactory.createBare as ReturnType<typeof vi.fn>).mockResolvedValue({
      invoke: vi.fn().mockResolvedValue({
        messages: [{ content: 'Task completed successfully.' }],
      }),
    });

    const result = await executeKeymakerTask('test-skill', 'do the task');

    expect(mockRegistry.getContent).toHaveBeenCalledWith('test-skill');
    expect(result).toBe('Task completed successfully.');
  });
});
