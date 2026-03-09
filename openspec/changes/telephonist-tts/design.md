## Context

Morpheus currently supports speech-to-text (STT) via the Telephonist module. Users send voice messages on Telegram/Discord, the Telephonist transcribes them, and Oracle processes the text. Responses are always text-only.

The Telephonist already supports multiple STT providers (OpenAI Whisper, Google Gemini, OpenRouter, Ollama) via a strategy pattern with `ITelephonist` interface and `createTelephonist()` factory. The OpenAI and Google Gemini SDKs are already project dependencies.

## Goals / Non-Goals

**Goals:**
- Add TTS synthesis capability to Telephonist with OpenAI and Google Gemini providers
- Make TTS opt-in via `audio.tts` config section (disabled by default)
- When enabled and input was audio, respond with voice instead of text
- Track TTS usage in audit events for observability and cost tracking
- Support hot-reload of TTS config without daemon restart

**Non-Goals:**
- TTS for text-only input (only triggers when user sent audio)
- Streaming TTS (generate full audio file, then send)
- TTS for async task results (only sync Oracle responses in voice handlers)
- Per-user or per-channel TTS toggle (global config only)
- New npm dependencies (use existing OpenAI and Google SDKs)

## Decisions

### Decision 1: TTS config nested under `audio.tts`

TTS config lives as a sub-object of `AudioConfig` rather than a top-level section.

```yaml
audio:
  provider: openai          # STT provider (existing)
  model: whisper-1          # STT model (existing)
  enabled: true             # STT enabled (existing)
  tts:
    enabled: false           # TTS disabled by default
    provider: openai         # openai | google
    model: tts-1             # tts-1, tts-1-hd, gemini-2.5-flash
    voice: alloy             # provider-specific voice ID
    apiKey: ''               # optional, falls back to audio.apiKey then llm.api_key
```

**Rationale:** Keeps all audio config together. TTS provider can differ from STT provider. The `apiKey` fallback chain mirrors the existing STT pattern.

**Alternative considered:** Separate top-level `tts` config section — rejected because audio concerns belong together and the config tree is already deep enough.

### Decision 2: Extend `ITelephonist` with optional `synthesize()`

Rather than a separate `ISynthesizer` interface, add `synthesize?()` to `ITelephonist`. A separate factory function `createTtsTelephonist()` builds the TTS-capable instance.

```typescript
export interface ITelephonist {
  transcribe(filePath: string, mimeType: string, apiKey: string): Promise<AudioTranscriptionResult>;
  synthesize?(text: string, apiKey: string, voice?: string): Promise<AudioSynthesisResult>;
}
```

**Rationale:** Pragmatically groups all audio operations in one module. The `?` makes it backward-compatible — existing STT-only implementations don't need to change. Channels check `telephonist.synthesize` existence before calling.

### Decision 3: Separate TTS telephonist instances

The channel adapter creates two telephonist instances: one for STT (existing), one for TTS (new). They may use different providers.

```typescript
private telephonist: ITelephonist | null = null;      // STT
private ttsTelephonist: ITelephonist | null = null;    // TTS
```

**Rationale:** Clean separation. STT and TTS may use different providers (e.g., Whisper for STT, OpenAI for TTS). Each is lazily created and cached with provider/model checks for hot-reload.

### Decision 4: Output format — always `.ogg` (Opus)

- **OpenAI TTS:** Request `response_format: 'opus'` → produces Opus in OGG container, perfect for Telegram/Discord voice messages.
- **Google Gemini:** Generate audio content, convert to OGG/Opus before sending.

**Rationale:** OGG/Opus is the native voice message format for both Telegram and Discord. No transcoding needed.

### Decision 5: Text length handling

OpenAI TTS has a 4096-character limit per request. For longer responses:
- Truncate at 4096 characters with a trailing indicator
- Log a warning about truncation

**Alternative considered:** Splitting into multiple audio chunks — rejected for complexity and UX (multiple voice messages are jarring).

### Decision 6: Audit events for TTS

TTS operations emit audit events with the same `event_type: 'telephonist'` but with distinguishing metadata:

```typescript
{
  event_type: 'telephonist',
  agent: 'telephonist',
  provider: 'openai',
  model: 'tts-1',
  status: 'success',
  metadata: {
    operation: 'tts',
    characters: 1234,
    voice: 'alloy'
  }
}
```

**Rationale:** Reuses existing audit infrastructure. The `operation` field distinguishes STT from TTS in queries.

## Risks / Trade-offs

- **[Cost]** TTS adds per-response cost (OpenAI TTS: ~$15/1M chars for tts-1). → Mitigation: Disabled by default, user must opt-in.
- **[Latency]** TTS adds synthesis time before response delivery (~1-3s for typical responses). → Mitigation: Acceptable for voice conversation UX; user already expects audio delay.
- **[Truncation]** Long Oracle responses may be truncated at 4096 chars. → Mitigation: Log warning; most conversational responses are well under this limit.
- **[Google TTS API]** Gemini's audio generation API is newer and may have different quality/limitations vs OpenAI. → Mitigation: OpenAI TTS as primary recommendation; Google as alternative.
