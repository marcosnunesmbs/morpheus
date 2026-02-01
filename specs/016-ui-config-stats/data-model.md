# Data Model: Advanced UI Configuration and Statistics

## Configuration Entities

### LLM Configuration (`src/config/schemas.ts`)
| Field | Type | Description |
|-------|------|-------------|
| `llm.max_tokens` | `number` (optional) | **New**. Maximum number of tokens to generate (context window limit). Default: `undefined` (model default). |

### Audio Configuration (`src/config/schemas.ts`)
| Field | Type | Description |
|-------|------|-------------|
| `audio.provider` | `enum` ('google') | **New**. The service provider for audio transcription. Default: `'google'`. |
| `audio.enabled` | `boolean` | Existing. |
| `audio.apiKey` | `string` | Existing. |
| `audio.maxDurationSeconds` | `number` | Existing. |
| `audio.supportedMimeTypes` | `string[]` | Existing. |

## Application State

### Usage Statistics (derived)
Aggregated from `SQLiteChatMessageHistory` messages table.

| Field | Type | Source |
|-------|------|--------|
| `totalInputTokens` | `integer` | `SUM(input_tokens)` from `messages` table. |
| `totalOutputTokens` | `integer` | `SUM(output_tokens)` from `messages` table. |
