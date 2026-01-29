import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Agent } from '../agent.js';
import { ProviderFactory } from '../providers/factory.js';
import { DEFAULT_CONFIG } from '../../types/config.js';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage } from '@langchain/core/messages';
import * as fs from 'fs-extra';
import * as path from 'path';
import { homedir } from 'os';

vi.mock('../providers/factory.js');

describe('Agent', () => {
  let agent: Agent;
  const mockProvider = {
    invoke: vi.fn(),
  } as unknown as BaseChatModel;

  beforeEach(async () => {
    vi.resetAllMocks();
    
    // Clean up any existing test database
    const defaultDbPath = path.join(homedir(), ".morpheus", "memory", "short-memory.db");
    if (fs.existsSync(defaultDbPath)) {
      try {
        const Database = (await import("better-sqlite3")).default;
        const db = new Database(defaultDbPath);
        db.exec("DELETE FROM messages");
        db.close();
      } catch (err) {
        // Ignore errors if database doesn't exist or is corrupted
      }
    }
    
    (mockProvider.invoke as any).mockResolvedValue(new AIMessage('Hello world'));
    vi.mocked(ProviderFactory.create).mockReturnValue(mockProvider);
    agent = new Agent(DEFAULT_CONFIG);
  });

  afterEach(async () => {
    // Clean up after each test
    if (agent) {
      try {
        await agent.clearMemory();
      } catch (err) {
        // Ignore cleanup errors
      }
    }
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
    
    // Clear any residual history from previous tests
    await agent.clearMemory();
    
    // First turn
    await agent.chat('Hi');
    const history1 = await agent.getHistory();
    expect(history1).toHaveLength(2);
    expect(history1[0].content).toBe('Hi'); // User
    expect(history1[1].content).toBe('Hello world'); // AI

    // Second turn
    // Update mock return value for next call
    (mockProvider.invoke as any).mockResolvedValue(new AIMessage('I am fine'));
    
    await agent.chat('How are you?');
    const history2 = await agent.getHistory();
    expect(history2).toHaveLength(4);
    expect(history2[2].content).toBe('How are you?');
    expect(history2[3].content).toBe('I am fine');
  });

  describe('Configuration Validation', () => {
    it('should throw if llm provider is missing', async () => {
        const invalidConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        delete invalidConfig.llm.provider; // Invalid
        
        const badAgent = new Agent(invalidConfig);
        await expect(badAgent.initialize()).rejects.toThrow('LLM provider not specified');
    });

    it('should propagate ProviderError during initialization', async () => {
        const mockError = new Error("Mock Factory Error");
        vi.mocked(ProviderFactory.create).mockImplementation(() => { throw mockError });
        
        // ProviderError constructs message as: "Provider {provider} failed: {originalError.message}"
        await expect(agent.initialize()).rejects.toThrow('Provider openai failed: Mock Factory Error');
    });
 });
});
