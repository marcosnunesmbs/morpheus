import { describe, it, expect, beforeEach, vi } from 'vitest';

// Define proper types for mocks
interface MockSkill {
  name: string;
  description?: string;
  enabled?: boolean;
  path?: string;
}

interface MockTask {
  id: string;
  agent: string;
  status: string;
}

interface DuplicateDelegation {
  task_id: string;
  agent: string;
  task: string;
}

// Use vi.hoisted to define mocks before they're used in vi.mock calls
const { mockRegistry, mockRepository, mockDisplay, mockContext } = vi.hoisted(() => ({
  mockRegistry: {
    get: vi.fn<() => MockSkill | undefined>(),
    getEnabled: vi.fn<() => MockSkill[]>(() => []),
  },
  mockRepository: {
    createTask: vi.fn<() => MockTask>(),
  },
  mockDisplay: {
    log: vi.fn(),
  },
  mockContext: {
    get: vi.fn(() => ({
      origin_channel: 'telegram',
      session_id: 'test-session',
      origin_message_id: '123',
      origin_user_id: 'user-1',
    })),
    findDuplicateDelegation: vi.fn<() => DuplicateDelegation | null>(() => null),
    canEnqueueDelegation: vi.fn(() => true),
    setDelegationAck: vi.fn(),
  },
}));

vi.mock('../registry.js', () => ({
  SkillRegistry: {
    getInstance: () => mockRegistry,
  },
}));

vi.mock('../../tasks/repository.js', () => ({
  TaskRepository: {
    getInstance: () => mockRepository,
  },
}));

vi.mock('../../tasks/context.js', () => ({
  TaskRequestContext: mockContext,
}));

vi.mock('../../display.js', () => ({
  DisplayManager: {
    getInstance: () => mockDisplay,
  },
}));

// Now import the module under test
import { SkillDelegateTool, getSkillDelegateDescription } from '../tool.js';

describe('SkillDelegateTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRegistry.get.mockReset();
    mockRegistry.getEnabled.mockReset();
    mockRepository.createTask.mockReset();
    mockDisplay.log.mockReset();
    mockContext.findDuplicateDelegation.mockReturnValue(null);
    mockContext.canEnqueueDelegation.mockReturnValue(true);
    
    // Set default mock returns
    mockRegistry.getEnabled.mockReturnValue([]);
  });

  describe('getSkillDelegateDescription()', () => {
    it('should include enabled skills in description', () => {
      mockRegistry.getEnabled.mockReturnValue([
        { name: 'code-review', description: 'Review code for issues' },
        { name: 'git-ops', description: 'Git operations helper' },
      ]);

      const description = getSkillDelegateDescription();

      expect(description).toContain('code-review: Review code for issues');
      expect(description).toContain('git-ops: Git operations helper');
    });

    it('should show no skills message when none enabled', () => {
      mockRegistry.getEnabled.mockReturnValue([]);

      const description = getSkillDelegateDescription();

      expect(description).toContain('(no skills enabled)');
    });
  });

  describe('invoke()', () => {
    it('should create task for valid skill', async () => {
      mockRegistry.get.mockReturnValue({
        name: 'test-skill',
        description: 'Test',
        enabled: true,
        path: '/path/to/skill',
      });
      mockRegistry.getEnabled.mockReturnValue([{ name: 'test-skill' }]);
      mockRepository.createTask.mockReturnValue({
        id: 'task-123',
        agent: 'keymaker',
        status: 'pending',
      });

      const result = await SkillDelegateTool.invoke({
        skillName: 'test-skill',
        objective: 'do the thing',
      });

      expect(mockRepository.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          agent: 'keymaker',
          input: 'do the thing',
          context: JSON.stringify({ skill: 'test-skill' }),
          origin_channel: 'telegram',
          session_id: 'test-session',
        })
      );
      expect(result).toContain('task-123');
      expect(result).toContain('queued');
    });

    it('should return error for non-existent skill', async () => {
      mockRegistry.get.mockReturnValue(undefined);
      mockRegistry.getEnabled.mockReturnValue([
        { name: 'other-skill' },
      ]);

      const result = await SkillDelegateTool.invoke({
        skillName: 'non-existent',
        objective: 'do something',
      });

      expect(result).toContain('Error');
      expect(result).toContain('not found');
      expect(result).toContain('other-skill');
      expect(mockRepository.createTask).not.toHaveBeenCalled();
    });

    it('should return error for disabled skill', async () => {
      mockRegistry.get.mockReturnValue({
        name: 'disabled-skill',
        description: 'Disabled',
        enabled: false,
        path: '/path',
      });

      const result = await SkillDelegateTool.invoke({
        skillName: 'disabled-skill',
        objective: 'do something',
      });

      expect(result).toContain('Error');
      expect(result).toContain('disabled');
      expect(mockRepository.createTask).not.toHaveBeenCalled();
    });

    it('should deduplicate delegation requests', async () => {
      mockRegistry.get.mockReturnValue({
        name: 'dup-skill',
        enabled: true,
        path: '/path',
      });
      mockContext.findDuplicateDelegation.mockReturnValue({
        task_id: 'existing-task',
        agent: 'keymaker',
        task: 'dup-skill:objective',
      });

      const result = await SkillDelegateTool.invoke({
        skillName: 'dup-skill',
        objective: 'objective',
      });

      expect(result).toContain('existing-task');
      expect(result).toContain('already queued');
      expect(mockRepository.createTask).not.toHaveBeenCalled();
    });

    it('should block when delegation limit reached', async () => {
      mockRegistry.get.mockReturnValue({
        name: 'limit-skill',
        enabled: true,
        path: '/path',
      });
      mockContext.canEnqueueDelegation.mockReturnValue(false);

      const result = await SkillDelegateTool.invoke({
        skillName: 'limit-skill',
        objective: 'objective',
      });

      expect(result).toContain('limit reached');
      expect(mockRepository.createTask).not.toHaveBeenCalled();
    });
  });
});
