# Data Model: Database Message Persistence

**Feature**: `021-db-msg-provider-model`

## SQLite Schema

### Table: `messages`

Existing table extended with:

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `provider` | `TEXT` | YES | The LLM provider key (e.g., 'openai', 'ollama'). NULL for legacy messages or system events. |
| `model` | `TEXT` | YES | The specific model identifier (e.g., 'gpt-4o', 'llama3'). NULL for legacy/system. |

### Migration Strategy

1. **Check**: Query `PRAGMA table_info(messages)`
2. **Action**: If `provider` missing -> `ALTER TABLE messages ADD COLUMN provider TEXT`
3. **Action**: If `model` missing -> `ALTER TABLE messages ADD COLUMN model TEXT`

## Entity Runtime

### `BaseMessage` Extensions

Runtime objects (in memory) will carry:

```typescript
interface MessageProviderMetadata {
  provider: string;
  model: string;
}

// Attached to BaseMessage instance
(message as any).provider_metadata: MessageProviderMetadata | undefined;
```
