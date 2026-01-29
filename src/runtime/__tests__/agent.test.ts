import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Agent } from '../agent.js';
import { ProviderFactory } from '../providers/factory.js';
import { DEFAULT_CONFIG } from '../../types/config.js';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage } from '@langchain/core/messages';

vi.mock('../providers/factory.js');

describe('Agent', () => {
  let agent: Agent;
  const mockProvider = {
    invoke: vi.fn(),
  } as unknown as BaseChatModel;

  beforeEach(() => {
    vi.resetAllMocks();
    (mockProvider.invoke as any).mockResolvedValue(new AIMessage('Hello world'));
    vi.mocked(ProviderFactory.create).mockReturnValue(mockProvider);
    agent = new Agent(DEFAULT_CONFIG);
  });

  it('should initialize successfully', async () => {
    await agent.initialize();
    expect(ProviderFactory.create).toHaveBeenCalledWith(DEFAULT_CONFIG.llm);
  });

  it('should chat successfully', async () => {
    await agent.initialize();
    const response = await agent.chat('Hi');
    expect(response).toBe('Hello world');
    expect(mockProvider.invoke).toHaveBeenCalled();
  });

  it('should throw if not initialized', async () => {
    await expect(agent.chat('Hi')).rejects.toThrow('initialize() first');
  });

  it('should maintain history', async () => {
    await agent.initialize();
    
    // First turn
    await agent.chat('Hi');
    expect(agent.getHistory()).toHaveLength(2);
    expect(agent.getHistory()[0].content).toBe('Hi'); // User
    expect(agent.getHistory()[1].content).toBe('Hello world'); // AI

    // Second turn
    // Update mock return value for next call
    (mockProvider.invoke as any).mockResolvedValue(new AIMessage('I am fine'));
    
    await agent.chat('How are you?');
    expect(agent.getHistory()).toHaveLength(4);
    expect(agent.getHistory()[2].content).toBe('How are you?');
    expect(agent.getHistory()[3].content).toBe('I am fine');
  });
});
