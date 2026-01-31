# Data Model: Audio Transcription

**Branch**: `012-audio-transcription`

## Configuration Schema

We will extend the core configuration schema (`src/config/schemas.ts`) to include audio settings.

### New Entity: `AudioConfig`

This object controls the behavior of the audio transcription features.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Master switch for audio features. |
| `apiKey` | `string` | optional | Optional Gemini API key specifically for audio transcription. If not set, falls back to main LLM key if provider is Gemini. |
| `maxDurationSeconds` | `number` | `300` | Maximum allowed duration for voice messages (to prevent API timeouts/abuse). |
| `supportedMimeTypes` | `string[]` | `['audio/ogg', 'audio/mp3', 'audio/mpeg', 'audio/wav']` | Allowed MIME types for processing. |

### Zod Definition

```typescript
// src/config/schemas.ts

export const AudioConfigSchema = z.object({
  enabled: z.boolean().default(true),
  apiKey: z.string().optional(),
  maxDurationSeconds: z.number().default(300),
  supportedMimeTypes: z.array(z.string()).default([
    'audio/ogg',
    'audio/mp3',
    'audio/mpeg',
    'audio/wav',
  ]),
});
```

### Config Integration

This schema will be added to the main `ConfigSchema`:

```typescript
// src/config/schemas.ts

export const ConfigSchema = z.object({
  // ... existing fields ...
  audio: AudioConfigSchema.default({}),
});
```

## Runtime Entities

### `VoiceMessageContext` (Ephemeral)

Not stored in DB, but passed during runtime processing within `TelegramAdapter`.

```typescript
interface VoiceMessageContext {
  fileId: string;
  duration: number; // in seconds
  mimeType: string;
  userId: string;
  chatId: string;
}
```
