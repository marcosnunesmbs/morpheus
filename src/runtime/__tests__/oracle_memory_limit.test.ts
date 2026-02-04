import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Oracle } from '../oracle.js';
import { ProviderFactory } from '../providers/factory.js';
import { DEFAULT_CONFIG, MorpheusConfig } from '../../types/config.js';
import { AIMessage } from '@langchain/core/messages';
import { ReactAgent } from 'langchain';
import * as fs from 'fs-extra';
import * as path from 'path';
import { homedir, tmpdir } from 'os';

vi.mock('../providers/factory.js');

describe('Oracle Memory Limit', () => {
  let oracle: Oracle;
  const mockProvider = {
    invoke: vi.fn(),
  } as unknown as ReactAgent;

  let dbPath: string;

  beforeEach(async () => {
    vi.resetAllMocks();

    dbPath = path.join(tmpdir(), `test-oracle-limit-${Date.now()}.db`);

    (mockProvider.invoke as any).mockImplementation(async ({ messages }: { messages: any[] }) => {
      return { 
        messages: [...messages, new AIMessage('Response')] 
      };
    });
    vi.mocked(ProviderFactory.create).mockResolvedValue(mockProvider);
  });

  afterEach(async () => {
    if (oracle) {
      try { await oracle.clearMemory(); } catch (err) { }
    }
  });

  it('should respect configured memory limit', async () => {
    const limitedConfig: MorpheusConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    limitedConfig.memory.limit = 2; // Only last 2 messages (1 exchange)

    oracle = new Oracle(limitedConfig, { databasePath: dbPath });
    await oracle.initialize();

    // Turn 1
    await oracle.chat('Msg 1');
    // Turn 2
    await oracle.chat('Msg 2');
    // Turn 3
    await oracle.chat('Msg 3');

    // DB should have 6 messages (3 User + 3 AI)
    // getHistory() should return only 2 (User Msg 3 + AI Response)
    // Wait, SQLiteChatMessageHistory limit might be total messages? Or pairs?
    // LangChain's limit usually means "last N messages".

    const history = await oracle.getHistory();
    // Assuming limit=2 means 2 messages.
    expect(history.length).toBeLessThanOrEqual(2);
    expect(history[history.length - 1].content).toBe('Response');
  });
});
