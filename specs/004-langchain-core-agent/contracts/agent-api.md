# API Contract: Core Agent

**Type**: Internal TypeScript Interface
**Consumer**: CLI Commands (`morpheus start`), UI Managers

## Interface Definition

```typescript
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { BaseMessage } from "@langchain/core/messages";

export interface IAgent {
  /**
   * Initialize the agent with configuration.
   * Throws error if validation fails.
   */
  initialize(): Promise<void>;

  /**
   * Process a user message and return the AI response.
   * Maintains internal session state.
   */
  chat(message: string): Promise<string>;

  /**
   * Get the current conversation history.
   */
  getHistory(): BaseMessage[];

  /**
   * Reset the current session.
   */
  clearMemory(): void;
}
```

## Error Handling

The `chat` method MUST accept standard text and return standard text.
If the LLM fails, it MUST throw a `ProviderError`.

```typescript
class ProviderError extends Error {
  constructor(
    public provider: string,
    public originalError: any,
    public suggestion: string // e.g., "Check your API key via 'morpheus config'"
  ) {
    super(`Provider ${provider} failed: ${originalError.message}`);
  }
}
```
