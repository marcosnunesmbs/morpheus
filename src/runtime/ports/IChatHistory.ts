/**
 * Port: IChatHistory
 *
 * Abstraction for reading and writing chat session history.
 * Decouples HTTP layer and Oracle from SQLiteChatMessageHistory.
 */
import type { BaseMessage } from '@langchain/core/messages';

export interface IChatHistory {
  /** Retrieve all messages for a session. */
  getMessages(sessionId: string): Promise<BaseMessage[]>;

  /** Append a message to a session. */
  addMessage(sessionId: string, message: BaseMessage): Promise<void>;

  /** Clear all messages for a session. */
  clear(sessionId: string): Promise<void>;
}
