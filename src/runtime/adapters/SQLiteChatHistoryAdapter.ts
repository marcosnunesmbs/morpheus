/**
 * Adapter: SQLiteChatHistoryAdapter
 *
 * Implements IChatHistory using SQLiteChatMessageHistory.
 * Allows the HTTP layer and Oracle to read/write chat history
 * without instantiating SQLiteChatMessageHistory directly.
 */
import type { IChatHistory } from '../ports/IChatHistory.js';
import type { BaseMessage } from '@langchain/core/messages';
import { SQLiteChatMessageHistory } from '../memory/sqlite.js';

export class SQLiteChatHistoryAdapter implements IChatHistory {
  async getMessages(sessionId: string): Promise<BaseMessage[]> {
    const history = new SQLiteChatMessageHistory({ sessionId });
    return history.getMessages();
  }

  async addMessage(sessionId: string, message: BaseMessage): Promise<void> {
    const history = new SQLiteChatMessageHistory({ sessionId });
    await history.addMessage(message);
  }

  async clear(sessionId: string): Promise<void> {
    const history = new SQLiteChatMessageHistory({ sessionId });
    await history.clear();
  }
}
