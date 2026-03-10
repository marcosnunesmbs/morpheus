# Data Model: Improved Init Flow

**Branch**: `013-improve-init-flow`

## Configuration Updates

No changes to the Zod Schema (`src/config/schemas.ts`) are required. The existing `AudioConfig` structure is sufficient.

```typescript
export interface AudioConfig {
  enabled: boolean;
  apiKey?: string; // Optional
  maxDurationSeconds: number;
  supportedMimeTypes: string[];
}
```

## Runtime State Logic

The `init` command acts as a functional transformation on the configuration state:

$$ Config_{new} = f(Config_{old}, UserInput) $$

### State Transition Rules for Audio

| Main Provider | User Enables Audio? | User Input (Audio Key) | Result: `audio.enabled` | Result: `audio.apiKey` |
| :--- | :--- | :--- | :--- | :--- |
| `gemini` | Yes | (Skipped) | `true` | `undefined` (Implicit reuse) |
| `openai` | Yes | "key_123" | `true` | "key_123" |
| `openai` | Yes | "" (Empty) | `false` | `undefined` |
| `any` | No | (Skipped) | `false` | `undefined` |

### Key Preservation Logic

For sensitive fields (API Keys), the state transition handles "Update vs Preserve":

- If `UserInput` is NOT EMPY -> Update `Config`
- If `UserInput` IS EMPTY AND `Config_{old}.key` EXISTS -> Preserve `Config_{old}.key`
- If `UserInput` IS EMPTY AND `Config_{old}.key` MISSING -> Set `undefined`
