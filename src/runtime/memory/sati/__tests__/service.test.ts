import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SatiService } from '../service.js';
import { SatiRepository } from '../repository.js';
import { ConfigManager } from '../../../../config/manager.js';
import { ProviderFactory } from '../../../providers/factory.js';

// Mock ConfigManager
vi.mock('../../../../config/manager.js', () => ({
  ConfigManager: {
    getInstance: vi.fn().mockReturnValue({
      get: vi.fn().mockReturnValue({ llm: { provider: 'test' } })
    })
  }
}));

// Mock ProviderFactory
vi.mock('../../../providers/factory.js', () => ({
  ProviderFactory: {
    create: vi.fn()
  }
}));

// Mock the repository module
vi.mock('../repository.js', () => {
  const SatiRepositoryMock = {
    getInstance: vi.fn(),
  };
  return { SatiRepository: SatiRepositoryMock };
});

describe('SatiService', () => {
  let service: SatiService;
  let mockRepo: any;
  let mockAgent: any;

  beforeEach(() => {
    vi.resetAllMocks();
    
    // Setup mock repository instance
    mockRepo = {
      initialize: vi.fn(),
      search: vi.fn(),
      save: vi.fn(),
      getAllMemories: vi.fn().mockReturnValue([]),
    };
    
    (SatiRepository.getInstance as any).mockReturnValue(mockRepo);
    
    // Setup mock agent
    mockAgent = {
        invoke: vi.fn()
    };
    (ProviderFactory.create as any).mockResolvedValue(mockAgent);

    service = SatiService.getInstance();
    (service as any).repository = mockRepo; 
  });

  describe('recover', () => {
      it('should recover memories calling repository with limit', async () => {
        mockRepo.search.mockReturnValue([
          { summary: 'Memory 1', category: 'preference', importance: 'high' },
          { summary: 'Memory 2', category: 'project', importance: 'medium' }
        ]);
    
        const result = await service.recover('hello world', []);
        
        expect(mockRepo.search).toHaveBeenCalledWith('hello world', 5);
        expect(result.relevant_memories).toHaveLength(2);
        expect(result.relevant_memories[0].summary).toBe('Memory 1');
      });
    
      it('should return empty list when no memories found', async () => {
        mockRepo.search.mockReturnValue([]);
        
        const result = await service.recover('unknown', []);
        
        expect(mockRepo.search).toHaveBeenCalledWith('unknown', 5);
        expect(result.relevant_memories).toEqual([]);
      });
  });

  describe('evaluateAndPersist', () => {
      it('should parse LLM response and persist memory', async () => {
        mockAgent.invoke.mockResolvedValue({
            messages: [{
                content: JSON.stringify({
                    should_store: true,
                    category: 'preference',
                    importance: 'high',
                    summary: 'User likes TypeScript',
                    reason: 'User stated preference'
                })
            }]
        });

        await service.evaluateAndPersist([{ role: 'user', content: 'I like TypeScript' }]);

        expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({
            summary: 'User likes TypeScript',
            category: 'preference',
            importance: 'high'
        }));
    });

    it('should not persist if should_store is false', async () => {
        mockAgent.invoke.mockResolvedValue({
            messages: [{
                content: JSON.stringify({
                    should_store: false,
                    reason: 'Chit chat'
                })
            }]
        });

        await service.evaluateAndPersist([{ role: 'user', content: 'Hi' }]);

        expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });
});
