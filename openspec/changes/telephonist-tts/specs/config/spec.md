## ADDED Requirements

### Requirement: TTS config section
The system SHALL support a `tts` sub-section under `audio` configuration with the following fields:

| Field | Type | Default | Description |
|---|---|---|---|
| `enabled` | boolean | `false` | Whether TTS responses are active |
| `provider` | `'openai' \| 'google'` | `'openai'` | TTS provider |
| `model` | string | `'tts-1'` | Provider-specific model ID |
| `voice` | string | `'alloy'` | Provider-specific voice ID |
| `apiKey` | string | `''` | Optional API key; falls back to `audio.apiKey`, then `llm.api_key` |

#### Scenario: TTS config with defaults
- **WHEN** `zaion.yaml` contains `audio.tts.enabled: true` with no other TTS fields
- **THEN** the system uses `provider: 'openai'`, `model: 'tts-1'`, `voice: 'alloy'`

#### Scenario: TTS config fully specified
- **WHEN** `zaion.yaml` contains `audio.tts: { enabled: true, provider: google, model: gemini-2.5-flash, voice: Kore, apiKey: xxx }`
- **THEN** all values are applied as configured

### Requirement: TTS config Zod schema
The system SHALL validate TTS config via a `TtsConfigSchema` Zod schema declared before `AudioConfigSchema` in `src/config/schemas.ts`.

#### Scenario: Invalid TTS provider rejected
- **WHEN** `zaion.yaml` has `audio.tts.provider: azure`
- **THEN** Zod validation fails with a clear error message

### Requirement: TTS environment variable overrides
The system SHALL support environment variable overrides for TTS config:

| Env Var | Config Path |
|---|---|
| `MORPHEUS_AUDIO_TTS_ENABLED` | `audio.tts.enabled` |
| `MORPHEUS_AUDIO_TTS_PROVIDER` | `audio.tts.provider` |
| `MORPHEUS_AUDIO_TTS_MODEL` | `audio.tts.model` |
| `MORPHEUS_AUDIO_TTS_VOICE` | `audio.tts.voice` |
| `MORPHEUS_AUDIO_TTS_API_KEY` | `audio.tts.apiKey` |

#### Scenario: Env var overrides YAML for TTS
- **WHEN** `zaion.yaml` has `audio.tts.provider: openai` and `MORPHEUS_AUDIO_TTS_PROVIDER=google` is set
- **THEN** `config.audio.tts.provider` is `'google'`

### Requirement: TTS config in HTTP API
The system SHALL include TTS config when reading or writing the audio config section via the existing audio config API endpoints.

#### Scenario: Audio config includes TTS
- **WHEN** `GET /api/config` is called
- **THEN** the response includes `audio.tts` with all TTS fields
