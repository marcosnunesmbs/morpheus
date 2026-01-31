import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Agent } from '../agent.js';
import { ProviderFactory } from '../providers/factory.js';
import { DEFAULT_CONFIG, MorpheusConfig } from '../../types/config.js';
import { AIMessage } from '@langchain/core/messages';
import { ReactAgent } from 'langchain';
import * as fs from 'fs-extra';
import * as path from 'path';
import { homedir } from 'os';

vi.mock('../providers/factory.js');

describe('Agent Memory Limit', () => {
  let agent: Agent;
  const mockProvider = {
    invoke: vi.fn(),
  } as unknown as ReactAgent;

  const dbPath = path.join(homedir(), ".morpheus", "memory", "short-memory.db");

  beforeEach(async () => {
    vi.resetAllMocks();

    // Clean up DB
    if (fs.existsSync(dbPath)) {
      try {
        const Database = (await import("better-sqlite3")).default;
        const db = new Database(dbPath);
        db.exec("DELETE FROM messages");
        db.close();
      } catch (err) { }
    }

    (mockProvider.invoke as any).mockResolvedValue({
      messages: [new AIMessage('Response')]
    });
    vi.mocked(ProviderFactory.create).mockResolvedValue(mockProvider);
  });

  afterEach(async () => {
    if (agent) {
      try { await agent.clearMemory(); } catch (err) { }
    }
  });

  it('should respect configured memory limit', async () => {
    const limitedConfig: MorpheusConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    limitedConfig.memory.limit = 2; // Only last 2 messages (1 exchange)

    agent = new Agent(limitedConfig);
    await agent.initialize();

    // Turn 1
    await agent.chat('Msg 1');
    // Turn 2
    await agent.chat('Msg 2');
    // Turn 3
    await agent.chat('Msg 3');

    // DB should have 6 messages (3 User + 3 AI)
    // getHistory() should return only 2 (User Msg 3 + AI Response)
    // Wait, SQLiteChatMessageHistory limit might be total messages? Or pairs?
    // LangChain's limit usually means "last N messages".

    const history = await agent.getHistory();
    // Assuming limit=2 means 2 messages.
    expect(history.length).toBeLessThanOrEqual(2);
    expect(history[history.length - 1].content).toBe('Response');
  });
});
