# Data Model: Agent Interaction & Config

## Configuration Schema

The `morpheus.json` configuration object will be extended to support the `channels` property.

### `MorpheusConfig`

```typescript
interface MorpheusConfig {
  // ... existing fields
  channels?: {
    telegram?: TelegramConfig;
  };
}
```

### `TelegramConfig`

```typescript
interface TelegramConfig {
  /**
    * Whether the Telegram adapter is active.
    */
  enabled: boolean;

  /**
    * The Bot API token provided by BotFather.
    * e.g., "123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
    */
  token: string;

  /**
    * List of User IDs authorized to interact with the bot.
    * Stored as strings to prevent integer precision issues with large IDs.
    * e.g., ["12345678", "98765432"]
    */
  allowedUsers: string[];
}
```

## Validation

1.  **allowedUsers**: Must be an array of strings. If user inputs numbers during `init`, they must be converted to strings.
2.  **token**: Required if `enabled` is true.
