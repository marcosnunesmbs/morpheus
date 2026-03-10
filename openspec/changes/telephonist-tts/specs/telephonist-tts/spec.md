## ADDED Requirements

### Requirement: TTS synthesis interface
The `ITelephonist` interface SHALL include an optional `synthesize()` method that converts text to an audio file on disk.

#### Scenario: Synthesize returns audio file path
- **WHEN** `synthesize("Hello world", apiKey)` is called on a TTS-capable telephonist
- **THEN** it returns an `AudioSynthesisResult` with `filePath` pointing to a valid `.ogg` file and `usage` containing provider metadata

#### Scenario: Synthesize not available on STT-only instance
- **WHEN** a telephonist is created with `createTelephonist()` (STT factory)
- **THEN** the `synthesize` property is `undefined`

### Requirement: TTS factory function
The system SHALL provide a `createTtsTelephonist(config)` factory function that returns an `ITelephonist` with `synthesize()` implemented, based on the `audio.tts` config.

#### Scenario: OpenAI TTS provider created
- **WHEN** `createTtsTelephonist({ provider: 'openai', model: 'tts-1', voice: 'alloy' })` is called
- **THEN** it returns an `OpenAITtsTelephonist` instance

#### Scenario: Google TTS provider created
- **WHEN** `createTtsTelephonist({ provider: 'google', model: 'gemini-2.5-flash', voice: 'Kore' })` is called
- **THEN** it returns a `GeminiTtsTelephonist` instance

#### Scenario: Unsupported TTS provider rejected
- **WHEN** `createTtsTelephonist({ provider: 'ollama', ... })` is called
- **THEN** an error is thrown listing supported TTS providers (openai, google)

### Requirement: OpenAI TTS implementation
The system SHALL synthesize audio using OpenAI's `audio.speech.create()` API with `response_format: 'opus'` and write the result to a temporary `.ogg` file.

#### Scenario: Successful OpenAI synthesis
- **WHEN** `synthesize("Hello", apiKey, "alloy")` is called on an OpenAI TTS telephonist
- **THEN** it calls `client.audio.speech.create({ model, voice, input, response_format: 'opus' })`
- **AND** writes the response buffer to a temp `.ogg` file
- **AND** returns the file path and usage metadata

#### Scenario: Text exceeding 4096 characters
- **WHEN** `synthesize(longText, apiKey)` is called with text longer than 4096 characters
- **THEN** the text is truncated to 4096 characters
- **AND** a warning is logged about truncation

### Requirement: Google Gemini TTS implementation
The system SHALL synthesize audio using Google Gemini's audio generation capabilities and produce an `.ogg` output file.

#### Scenario: Successful Google synthesis
- **WHEN** `synthesize("Hello", apiKey, "Kore")` is called on a Google TTS telephonist
- **THEN** it uses the Gemini SDK to generate audio content
- **AND** writes the result to a temp `.ogg` file
- **AND** returns the file path and usage metadata

### Requirement: TTS audit events
The system SHALL emit an audit event for every TTS synthesis operation, including both successful and failed attempts.

#### Scenario: Successful TTS audit
- **WHEN** TTS synthesis completes successfully
- **THEN** an audit event is emitted with `event_type: 'telephonist'`, `agent: 'telephonist'`, the TTS provider/model, `status: 'success'`, and metadata containing `operation: 'tts'`, character count, and voice

#### Scenario: Failed TTS audit
- **WHEN** TTS synthesis fails
- **THEN** an audit event is emitted with `status: 'error'` and the error detail in metadata
- **AND** the channel falls back to sending the text response

### Requirement: Temp file cleanup
The system SHALL delete temporary TTS audio files after they have been sent to the channel.

#### Scenario: File cleaned up after send
- **WHEN** a TTS audio file is generated and sent to Telegram
- **THEN** the temp file is deleted in a `finally` block regardless of send success
