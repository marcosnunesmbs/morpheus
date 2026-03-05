import { describe, it, expect, beforeEach, vi } from 'vitest';

// Define proper types for mocks
interface MockSkill {
  name: string;
  description?: string;
  enabled?: boolean;
  content?: string;
  path?: string;
}

// Use vi.hoisted to define mocks before they're used in vi.mock calls
const { mockRegistry, mockAudit, mockContext } = vi.hoisted(() => ({
  mockRegistry: {
    get: vi.fn<() => MockSkill | undefined>(),
    getEnabled: vi.fn<() => MockSkill[]>(() => []),
  },
  mockAudit: {
    insert: vi.fn(),
  },
  mockContext: {
    get: vi.fn(() => ({
      origin_channel: 'telegram',
      session_id: 'test-session',
      origin_message_id: '123',
      origin_user_id: 'user-1',
    })),
  },
}));

vi.mock('../registry.js', () => ({
  SkillRegistry: {
    getInstance: () => mockRegistry,
  },
}));

vi.mock('../../audit/repository.js', () => ({
  AuditRepository: {
    getInstance: () => mockAudit,
  },
}));

vi.mock('../../tasks/context.js', () => ({
  TaskRequestContext: mockContext,
}));

// Now import the module under test
import { createLoadSkillTool } from '../tool.js';

describe('load_skill tool', () => {
  let loadSkillTool: ReturnType<typeof createLoadSkillTool>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRegistry.get.mockReset();
    mockRegistry.getEnabled.mockReset();
    mockRegistry.getEnabled.mockReturnValue([]);
    loadSkillTool = createLoadSkillTool();
  });

  it('should return skill content for valid enabled skill', async () => {
    mockRegistry.get.mockReturnValue({
      name: 'test-skill',
      description: 'Test',
      enabled: true,
      content: '# Instructions\n\nDo the thing.',
    });

    const result = await loadSkillTool.invoke({ skillName: 'test-skill' });

    expect(result).toContain('Loaded skill: test-skill');
    expect(result).toContain('# Instructions');
    expect(result).toContain('Do the thing.');
  });

  it('should emit skill_loaded audit event', async () => {
    mockRegistry.get.mockReturnValue({
      name: 'test-skill',
      description: 'Test',
      enabled: true,
      content: 'Instructions',
    });

    await loadSkillTool.invoke({ skillName: 'test-skill' });

    expect(mockAudit.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'skill_loaded',
        agent: 'oracle',
        tool_name: 'test-skill',
        status: 'success',
        session_id: 'test-session',
      })
    );
  });

  it('should return error for non-existent skill', async () => {
    mockRegistry.get.mockReturnValue(undefined);
    mockRegistry.getEnabled.mockReturnValue([
      { name: 'other-skill', description: 'Other' },
    ]);

    const result = await loadSkillTool.invoke({ skillName: 'non-existent' });

    expect(result).toContain('not found');
    expect(result).toContain('other-skill');
  });

  it('should return error for disabled skill', async () => {
    mockRegistry.get.mockReturnValue({
      name: 'disabled-skill',
      description: 'Disabled',
      enabled: false,
    });

    const result = await loadSkillTool.invoke({ skillName: 'disabled-skill' });

    expect(result).toContain('disabled');
  });

  it('should show no skills available when none enabled', async () => {
    mockRegistry.get.mockReturnValue(undefined);
    mockRegistry.getEnabled.mockReturnValue([]);

    const result = await loadSkillTool.invoke({ skillName: 'anything' });

    expect(result).toContain('not found');
    expect(result).toContain('none');
  });
});
