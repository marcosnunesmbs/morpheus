## Why

Users who interact with Morpheus via voice messages on Telegram/Discord currently receive text-only responses. To create a natural conversational audio experience, the Telephonist should support text-to-speech (TTS) synthesis, allowing channels to respond with audio when the input was audio and TTS is enabled.

## What Changes

- Add TTS configuration under `audio.tts` with separate provider/model/voice/apiKey settings
- Extend `ITelephonist` interface with a `synthesize()` method
- Implement TTS for OpenAI (`client.audio.speech.create()`) and Google Gemini providers
- Modify Telegram and Discord voice handlers to optionally respond with audio after Oracle replies
- Emit audit events for TTS operations (provider, model, character count, duration)
- Add TTS settings to the Settings UI audio section

## Capabilities

### New Capabilities
- `telephonist-tts`: Text-to-speech synthesis via Telephonist, including TTS config, provider implementations (OpenAI, Google), audio file generation (.ogg), and audit tracking

### Modified Capabilities
- `channels`: Telegram and Discord voice message handlers gain a conditional audio-response path — after Oracle responds, if `audio.tts.enabled`, synthesize and send voice instead of text
- `config`: New `audio.tts` config section with Zod schema, env var overrides, and HTTP API support

## Impact

- **Config**: New `TtsConfig` type nested under `AudioConfig`; new Zod schema `TtsConfigSchema`; env vars `MORPHEUS_AUDIO_TTS_*`
- **Telephonist**: New `synthesize()` on `ITelephonist`; new `OpenAITtsTelephonist` and `GeminiTtsTelephonist` classes; new factory `createTtsTelephonist()`
- **Channels**: `telegram.ts` and `discord.ts` voice handlers modified to call TTS and send audio
- **Audit**: New audit events with `event_type: 'telephonist'` and TTS-specific metadata
- **Dependencies**: No new npm packages needed (OpenAI and Google SDKs already present)
- **UI**: Settings audio section extended with TTS toggle, provider, model, voice fields
