# Internal API: SQLite Memory Interface

## Interface: `SQLiteChatMessageHistory`

This class adapts the LangChain `BaseListChatMessageHistory` interface to SQLite.

```typescript
import { BaseListChatMessageHistory } from "@langchain/core/chat_history";
import { BaseMessage } from "@langchain/core/messages";
import Database from "better-sqlite3";

export interface SQLiteChatMessageHistoryInput {
  sessionId: string;
  config?: Database.Options;
}

export class SQLiteChatMessageHistory extends BaseListChatMessageHistory {
  lc_namespace: string[];
  
  constructor(fields: SQLiteChatMessageHistoryInput);

  /**
   * Retrieves all messages from the database for the current session.
   * Maps 'human' -> HumanMessage, 'ai' -> AIMessage, 'system' -> SystemMessage.
   */
  getMessages(): Promise<BaseMessage[]>;

  /**
   * Adds a message to the database.
   * Serializes the message type and content.
   */
  addMessage(message: BaseMessage): Promise<void>;

  /**
   * Clears all messages for the current session.
   */
  clear(): Promise<void>;
}
```

## Integration: `Agent`

The `Agent` class will be updated to use this interface.

```typescript
// src/runtime/agent.ts

export class Agent implements IAgent {
   // ...
   private history: BaseListChatMessageHistory; 
   // was: private history: BaseMessage[] = [];
   // ...
}
```
