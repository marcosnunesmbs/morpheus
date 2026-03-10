# Internal API Contracts

## Channels Module

### `TelegramAdapter`

Active adapter for the Telegram Bot API.

**Location**: `src/channels/telegram.ts`

```typescript
import { Agent } from '../runtime/agent.js';

export class TelegramAdapter {
  /**
   * Initialize the adapter with the Agent instance it will use for processing.
   * @param agent The initialized Morpheus agent instance.
   */
  constructor(agent: Agent);

  /**
   * Connect to the Telegram API using the provided token.
   * Sets up event listeners for messages.
   * @param token The Telegram Bot API Token.
   * @param allowedUsers List of user IDs (as strings) to accept messages from.
   * @throws Error if connection fails.
   */
  public async connect(token: string, allowedUsers: string[]): Promise<void>;

  /**
   * Gracefully disconnect the bot and clean up listeners.
   */
  public async disconnect(): Promise<void>;
}
```

## CLI Module

### `initCommand`

The initialization flow will be updated to return a superset of the config.

**Location**: `src/cli/commands/init.ts`

**Prompt Flow**:
1.  ... Basic Setup ...
2.  `confirm`: "Configure external channels?" (Default: false)
3.  If Yes:
    *   `checkbox` or `select`: "Select channels to configure" -> `['Telegram']`
    *   If Telegram selected:
        *   `password`: "Enter Telegram Bot Token" (Masked input)
        *   `input`: "Enter Allowed User IDs (comma separated)" -> Parse to `string[]`

## Runtime Module

### `Agent`

Existing contract (no changes required, just usage):

```typescript
class Agent {
  /**
   * Process a natural language message and return a response.
   */
  public async chat(message: string): Promise<string>;
}
```
