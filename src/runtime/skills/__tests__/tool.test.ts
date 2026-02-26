import { describe, it, expect, beforeEach, vi } from 'vitest';

// Define proper types for mocks
interface MockSkill {
  name: string;
  description?: string;
  enabled?: boolean;
  execution_mode?: 'sync' | 'async';
  content?: string;
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
const { mockRegistry, mockRepository, mockDisplay, mockContext, mockKeymaker } = vi.hoisted(() => ({
  mockRegistry: {
    get: vi.fn<() => MockSkill | undefined>(),
    getEnabled: vi.fn<() => MockSkill[]>(() => []),
    getContent: vi.fn<() => string | null>(() => null),
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
  mockKeymaker: {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    executeKeymakerTask: vi.fn((_skill: string, _obj: string, _ctx: unknown) => Promise.resolve('Keymaker result')),
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

vi.mock('../../keymaker.js', () => ({
  executeKeymakerTask: (skillName: string, objective: string, context: unknown) => 
    mockKeymaker.executeKeymakerTask(skillName, objective, context),
}));

// Now import the module under test
import { 
  SkillExecuteTool, 
  SkillDelegateTool, 
  getSkillExecuteDescription, 
  getSkillDelegateDescription 
} from '../tool.js';

describe('SkillExecuteTool (sync)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRegistry.get.mockReset();
    mockRegistry.getEnabled.mockReset();
    mockKeymaker.executeKeymakerTask.mockReset();
    mockKeymaker.executeKeymakerTask.mockResolvedValue('Keymaker result');
    mockRegistry.getEnabled.mockReturnValue([]);
  });

  describe('getSkillExecuteDescription()', () => {
    it('should include enabled sync skills in description', () => {
      mockRegistry.getEnabled.mockReturnValue([
        { name: 'code-review', description: 'Review code for issues', execution_mode: 'sync' },
        { name: 'git-ops', description: 'Git operations helper', execution_mode: 'sync' },
        { name: 'deploy', description: 'Deploy to prod', execution_mode: 'async' }, // should not appear
      ]);

      const description = getSkillExecuteDescription();

      expect(description).toContain('code-review: Review code for issues');
      expect(description).toContain('git-ops: Git operations helper');
      expect(description).not.toContain('deploy');
    });

    it('should show no sync skills message when none enabled', () => {
      mockRegistry.getEnabled.mockReturnValue([]);

      const description = getSkillExecuteDescription();

      expect(description).toContain('(no sync skills enabled)');
    });
  });

  describe('invoke()', () => {
    it('should execute sync skill via Keymaker', async () => {
      mockRegistry.get.mockReturnValue({
        name: 'test-skill',
        description: 'Test',
        enabled: true,
        execution_mode: 'sync',
        content: 'Instructions here',
      });
      mockRegistry.getEnabled.mockReturnValue([{ name: 'test-skill', execution_mode: 'sync' }]);

      const result = await SkillExecuteTool.invoke({
        skillName: 'test-skill',
        objective: 'do the thing',
      });

      expect(mockKeymaker.executeKeymakerTask).toHaveBeenCalledWith(
        'test-skill',
        'do the thing',
        expect.objectContaining({
          origin_channel: 'telegram',
          session_id: 'test-session',
        })
      );
      expect(result).toBe('Keymaker result');
    });

    it('should return error for non-existent skill', async () => {
      mockRegistry.get.mockReturnValue(undefined);
      mockRegistry.getEnabled.mockReturnValue([
        { name: 'other-skill', execution_mode: 'sync' },
      ]);

      const result = await SkillExecuteTool.invoke({
        skillName: 'non-existent',
        objective: 'do something',
      });

      expect(result).toContain('Error');
      expect(result).toContain('not found');
      expect(result).toContain('other-skill');
    });

    it('should return error for async skill', async () => {
      mockRegistry.get.mockReturnValue({
        name: 'async-skill',
        description: 'Async only',
        enabled: true,
        execution_mode: 'async',
      });

      const result = await SkillExecuteTool.invoke({
        skillName: 'async-skill',
        objective: 'do something',
      });

      expect(result).toContain('Error');
      expect(result).toContain('async-only');
      expect(result).toContain('skill_delegate');
    });
  });
});

describe('SkillDelegateTool (async)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRegistry.get.mockReset();
    mockRegistry.getEnabled.mockReset();
    mockRepository.createTask.mockReset();
    mockDisplay.log.mockReset();
    mockContext.findDuplicateDelegation.mockReturnValue(null);
    mockContext.canEnqueueDelegation.mockReturnValue(true);
    mockRegistry.getEnabled.mockReturnValue([]);
  });

  describe('getSkillDelegateDescription()', () => {
    it('should include enabled async skills in description', () => {
      mockRegistry.getEnabled.mockReturnValue([
        { name: 'deploy-staging', description: 'Deploy to staging', execution_mode: 'async' },
        { name: 'batch-process', description: 'Process batch jobs', execution_mode: 'async' },
        { name: 'code-review', description: 'Review code', execution_mode: 'sync' }, // should not appear
      ]);

      const description = getSkillDelegateDescription();

      expect(description).toContain('deploy-staging: Deploy to staging');
      expect(description).toContain('batch-process: Process batch jobs');
      expect(description).not.toContain('code-review');
    });

    it('should show no async skills message when none enabled', () => {
      mockRegistry.getEnabled.mockReturnValue([]);

      const description = getSkillDelegateDescription();

      expect(description).toContain('(no async skills enabled)');
    });
  });

  describe('invoke()', () => {
    it('should create task for valid async skill', async () => {
      mockRegistry.get.mockReturnValue({
        name: 'deploy-staging',
        description: 'Deploy',
        enabled: true,
        execution_mode: 'async',
      });
      mockRegistry.getEnabled.mockReturnValue([{ name: 'deploy-staging', execution_mode: 'async' }]);
      mockRepository.createTask.mockReturnValue({
        id: 'task-123',
        agent: 'keymaker',
        status: 'pending',
      });

      const result = await SkillDelegateTool.invoke({
        skillName: 'deploy-staging',
        objective: 'deploy to staging',
      });

      expect(mockRepository.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          agent: 'keymaker',
          input: 'deploy to staging',
          context: JSON.stringify({ skill: 'deploy-staging' }),
          origin_channel: 'telegram',
          session_id: 'test-session',
        })
      );
      expect(result).toContain('task-123');
      expect(result).toContain('queued');
    });

    it('should return error for sync skill', async () => {
      mockRegistry.get.mockReturnValue({
        name: 'sync-skill',
        description: 'Sync',
        enabled: true,
        execution_mode: 'sync',
      });

      const result = await SkillDelegateTool.invoke({
        skillName: 'sync-skill',
        objective: 'do something',
      });

      expect(result).toContain('Error');
      expect(result).toContain('sync');
      expect(result).toContain('skill_execute');
      expect(mockRepository.createTask).not.toHaveBeenCalled();
    });

    it('should return error for non-existent skill', async () => {
      mockRegistry.get.mockReturnValue(undefined);
      mockRegistry.getEnabled.mockReturnValue([
        { name: 'other-skill', execution_mode: 'async' },
      ]);

      const result = await SkillDelegateTool.invoke({
        skillName: 'non-existent',
        objective: 'do something',
      });

      expect(result).toContain('Error');
      expect(result).toContain('not found');
      expect(mockRepository.createTask).not.toHaveBeenCalled();
    });

    it('should return error for disabled skill', async () => {
      mockRegistry.get.mockReturnValue({
        name: 'disabled-skill',
        description: 'Disabled',
        enabled: false,
        execution_mode: 'async',
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
        execution_mode: 'async',
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
        execution_mode: 'async',
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
