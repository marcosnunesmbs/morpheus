## 1. Config & Types

- [x] 1.1 Add `TtsConfig` interface to `src/types/config.ts` with fields: `enabled`, `provider`, `model`, `voice`, `apiKey`
- [x] 1.2 Add `TtsConfigSchema` Zod schema in `src/config/schemas.ts` (before `AudioConfigSchema`) and nest it inside `AudioConfigSchema`
- [x] 1.3 Add TTS defaults to `DEFAULT_CONFIG.audio.tts` in `src/types/config.ts`
- [x] 1.4 Add env var overrides for `MORPHEUS_AUDIO_TTS_*` in `src/config/manager.ts`

## 2. Telephonist TTS Core

- [x] 2.1 Add `AudioSynthesisResult` interface and `synthesize?()` method to `ITelephonist` in `src/runtime/telephonist.ts`
- [x] 2.2 Implement `OpenAITtsTelephonist` class with `synthesize()` using `client.audio.speech.create()` with `response_format: 'opus'`, writing to temp `.ogg` file
- [x] 2.3 Implement `GeminiTtsTelephonist` class with `synthesize()` using Google Gemini audio generation, writing to temp `.ogg` file
- [x] 2.4 Add text truncation at 4096 chars with warning log in both implementations
- [x] 2.5 Add `createTtsTelephonist(config)` factory function supporting `openai` and `google` providers

## 3. Channel Integration — Telegram

- [x] 3.1 Add `ttsTelephonist` instance field and lazy creation logic in `TelegramAdapter` (with provider/model cache check for hot-reload)
- [x] 3.2 Modify voice message handler: after Oracle responds, check `audio.tts.enabled` → call `ttsTelephonist.synthesize()` → `ctx.replyWithVoice()` with `.ogg` file
- [x] 3.3 Add TTS audit event emission (success/failure) with `event_type: 'telephonist'`, `operation: 'tts'` metadata
- [x] 3.4 Add fallback: if TTS synthesis fails, send text response and log error
- [x] 3.5 Add temp file cleanup in `finally` block for TTS audio files

## 4. Channel Integration — Discord

- [x] 4.1 Add `ttsTelephonist` instance field and lazy creation logic in `DiscordAdapter`
- [x] 4.2 Modify audio attachment handler: after Oracle responds, check `audio.tts.enabled` → call `ttsTelephonist.synthesize()` → send `.ogg` as attachment
- [x] 4.3 Add TTS audit event emission (success/failure) with same metadata pattern as Telegram
- [x] 4.4 Add fallback and temp file cleanup (same pattern as Telegram)

## 5. UI — Settings

- [x] 5.1 Add TTS settings section in Settings audio tab: toggle, provider select, model input, voice input, apiKey input

## 6. Testing

- [x] 6.1 Add unit tests for `createTtsTelephonist()` factory (valid/invalid providers)
- [x] 6.2 Add unit tests for text truncation logic (under/over 4096 chars)
