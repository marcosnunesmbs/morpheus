# Data Model: Settings Form UI

## Configuration Object
The core data model is the `MorpheusConfig` structure, defined in `src/types/config.ts`.

```typescript
interface MorpheusConfig {
  agent: {
    name: string;
    personality: string;
  };
  llm: {
    provider: 'openai' | 'anthropic' | 'ollama' | 'gemini';
    model: string;
    temperature: number; // 0.0 - 1.0
    api_key?: string; // Optional (masked or empty in UI if sensitive?)
  };
  channels: {
    telegram: {
      enabled: boolean;
      token?: string;
      allowedUsers: string[];
    };
    discord: {
      enabled: boolean;
      token?: string;
    };
  };
  ui: {
    enabled: boolean;
    port: number;
  };
  logging: {
    enabled: boolean;
    level: 'debug' | 'info' | 'warn' | 'error';
    retention: string;
  };
}
```

## Validation Rules (Zod)
- **Strings**: `name`, `personality` (required, non-empty)
- **Enums**: `provider`, `level` must match allowed values.
- **Numbers**: `temperature` (0-1), `port` (valid port range).
- **Booleans**: `enabled` flags.

## API Payload
### Request (POST /api/config)
```json
{
  "agent": { ... },
  "llm": { ... },
  ...
}
```
*Note: The API expects the full object structure. Omitted fields might be treated as defaults or errors depending on implementation.*
