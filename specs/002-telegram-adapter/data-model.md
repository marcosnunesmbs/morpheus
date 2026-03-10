# Data Model: Telegram Channel Adapter

## Configuration Updates (`config.yaml`)

The `channels` section is updated to include `telegram`.

```yaml
channels:
  telegram:
    enabled: boolean        # default: false
    token: string           # "123456:ABC-..."
```

## Runtime State

### TelegramAdapter
In-memory state within the running process found in `src/channels/telegram.ts`.

- **Properties**:
    - `bot`: Telegraf instance.
    - `isConnected`: boolean status.
    - `startTime`: timestamp.

### CLI Input (`morpheus config set`)
- **Key**: String (dot notation).
- **Value**: String (parsed to primitive).

## Type Definitions

```typescript
// src/types/channels.ts

export interface TelegramConfig {
  enabled: boolean;
  token?: string;
}

export interface Adapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  status(): string;
}
```
